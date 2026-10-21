#!/usr/bin/env python3
"""PreToolUse hook: auto-approve read-only Supabase MCP calls.

- Read-only Supabase tools (list_tables, get_advisors, ...) are approved.
- execute_sql is approved only when the query is ONE read statement
  (SELECT / WITH / EXPLAIN / SHOW / VALUES / TABLE), contains no write
  keyword, and calls no function outside a list of known-safe builtins
  (a SELECT can still write through an RPC such as admin_adjust_wallet()).
- Anything else prints nothing: the normal permission prompt applies.
"""
import json
import re
import sys

READ_ONLY_TOOLS = {
    "list_tables", "list_migrations", "list_extensions", "get_advisors",
    "get_project", "get_project_url", "search_docs", "generate_typescript_types",
    "list_edge_functions", "get_edge_function", "list_branches", "query_logs",
    "get_logs", "list_projects", "get_organization", "list_organizations",
}

WRITE_WORDS = (
    "insert update delete drop alter create truncate grant revoke comment merge "
    "copy vacuum analyze call do execute perform set reset lock refresh cluster "
    "reindex security listen notify unlisten prepare deallocate import into "
    "begin commit rollback savepoint discard load checkpoint"
).split()

# Words that may legitimately precede "(" in a read query.
SAFE_CALLS = set((
    # SQL keywords followed by a parenthesis
    "in exists any all some over filter as from join on values and or not when then "
    "else using where select with case lateral within group by array row cast "
    "interval is between like ilike similar distinct union except intersect returning "
    # aggregates and window functions
    "count sum avg min max array_agg string_agg json_agg jsonb_agg json_object_agg "
    "jsonb_object_agg bool_and bool_or every stddev stddev_pop stddev_samp variance "
    "var_pop var_samp percentile_cont percentile_disc mode row_number rank dense_rank "
    "percent_rank cume_dist ntile lag lead first_value last_value nth_value corr "
    # scalar functions
    "coalesce nullif greatest least abs round ceil ceiling floor trunc sign sqrt power "
    "mod ln log exp div random width_bucket "
    "lower upper length char_length octet_length trim btrim ltrim rtrim substring substr "
    "left right replace split_part position strpos concat concat_ws format lpad rpad "
    "initcap reverse repeat regexp_replace regexp_match regexp_matches regexp_split_to_array "
    "regexp_split_to_table starts_with to_char to_number to_date to_timestamp md5 "
    "now current_date current_time current_timestamp localtimestamp clock_timestamp "
    "date_trunc date_part extract age make_date make_interval make_timestamp timezone "
    "generate_series unnest array_length array_position array_remove array_to_string "
    "string_to_array cardinality "
    "json_build_object jsonb_build_object json_build_array jsonb_build_array "
    "jsonb_array_length json_array_length jsonb_object_keys json_object_keys "
    "jsonb_array_elements json_array_elements jsonb_array_elements_text "
    "json_array_elements_text jsonb_each jsonb_each_text json_each json_each_text "
    "jsonb_typeof json_typeof jsonb_pretty to_json to_jsonb jsonb_path_query "
    "jsonb_extract_path jsonb_extract_path_text "
    "pg_get_functiondef pg_get_function_identity_arguments pg_get_function_arguments "
    "pg_get_function_result pg_get_viewdef pg_get_constraintdef pg_get_indexdef "
    "pg_get_triggerdef pg_get_expr pg_get_userbyid pg_size_pretty pg_total_relation_size "
    "pg_relation_size pg_table_size pg_indexes_size pg_database_size format_type "
    "obj_description col_description to_regclass to_regproc to_regprocedure "
    "has_table_privilege has_function_privilege has_schema_privilege current_setting "
    "quote_ident quote_literal current_user session_user version gen_random_uuid "
    "numeric int integer bigint text varchar date timestamp timestamptz boolean "
    "double float decimal real smallint uuid jsonb json char"
).split())

FUNCTION_SCHEMAS = ("pg_catalog",)


def strip_noise(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    sql = re.sub(r"--[^\n]*", " ", sql)
    sql = re.sub(r"\$([A-Za-z_]*)\$.*?\$\1\$", " '' ", sql, flags=re.S)
    sql = re.sub(r"'(?:[^']|'')*'", " '' ", sql)
    sql = re.sub(r'"(?:[^"]|"")*"', " ident ", sql)
    return sql.lower()


def is_read_only(sql: str) -> bool:
    s = strip_noise(sql).strip().rstrip(";").strip()
    if not s or ";" in s:
        return False
    if not re.match(r"^(select|with|explain|show|values|table)\b", s):
        return False
    if any(re.search(rf"\b{w}\b", s) for w in WRITE_WORDS):
        return False
    for m in re.finditer(r"([a-z_][a-z0-9_$]*(?:\.[a-z_][a-z0-9_$]*)?)\s*\(", s):
        name = m.group(1)
        schema, _, fn = name.rpartition(".")
        if schema and schema not in FUNCTION_SCHEMAS:
            return False
        if fn not in SAFE_CALLS:
            return False
    return True


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    tool = data.get("tool_name", "")
    if not re.search(r"supabase", tool, re.I):
        return
    action = tool.rsplit("__", 1)[-1]
    reason = None
    if action in READ_ONLY_TOOLS:
        reason = "Supabase read-only tool"
    elif action == "execute_sql" and is_read_only((data.get("tool_input") or {}).get("query", "")):
        reason = "Read-only SQL (SELECT)"
    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "permissionDecisionReason": reason,
        }}))


if __name__ == "__main__":
    main()
