/**
 * Analyses mobile v2 — exporter (CSV, PDF, image) et partager.
 *
 * Tout passe par les API standard du navigateur : `<a download>` sur un blob,
 * `navigator.share` avec un fichier, `navigator.clipboard.write`. Dans l'app
 * BONZINI HQ, `hq-app/src/bridge.ts` les intercepte (enregistrer, feuille de
 * partage du téléphone, presse-papiers) — ne pas les contourner.
 */
import { jsPDF } from 'jspdf';
import { downloadCsv, rowsToCsv } from '@/lib/analytics/csvExport';
import type { DateRange } from '@/lib/analytics/dateRange';
import { captureNodePng, copyNodePng, triggerDownload, type CopyOutcome } from '@/lib/nodeImage';
import { fileDay, periodLabel } from './format';
import type { ChartDataset } from './state';

export type ExportFormat = 'csv' | 'pdf' | 'png';

/** « paiements_22-09_21-10.csv » */
export function exportFileName(ds: ChartDataset | null, range: DateRange, ext: string): string {
  const stem = ds ? ds.key.replace(/[^a-z0-9-]+/gi, '_') : 'analyses';
  return `${stem}_${fileDay(range.from)}_${fileDay(new Date(range.to.getTime() - 1))}.${ext}`;
}

const BOM = '﻿';

/** Un graphe, ou plusieurs sections (titre, en-tête, lignes) séparées d'une ligne vide. */
export function datasetsCsv(list: ChartDataset[], range: DateRange): string {
  if (list.length === 1) return rowsToCsv(list[0].rows, { columns: list[0].columns });
  const parts = list.map((ds) => {
    const body = rowsToCsv(ds.rows, { columns: ds.columns }).replace(BOM, '');
    return `${ds.title} · ${periodLabel(range)}\r\n${body}`;
  });
  return BOM + parts.join('\r\n\r\n');
}

export function exportCsv(list: ChartDataset[], range: DateRange, single: ChartDataset | null): void {
  downloadCsv(exportFileName(single, range, 'csv'), datasetsCsv(list, range));
}

/** La police standard du PDF ne connaît ni les espaces fines ni le signe moins typographique. */
function pdfText(v: unknown): string {
  return String(v ?? '')
    .replace(/[\u00A0\u202F\u2009]/g, ' ')
    .replace(/−/g, '-')
    .replace(/→/g, '->')
    .replace(/[‘’]/g, "'");
}

/** Un rapport PDF A4 : pour chaque graphe, le titre, le chiffre et le tableau. */
export function exportPdf(list: ChartDataset[], range: DateRange, single: ChartDataset | null): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const Hp = doc.internal.pageSize.getHeight();
  const M = 44;
  let y = M;
  const ensure = (h: number) => {
    if (y + h > Hp - M) { doc.addPage(); y = M; }
  };
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text('Bonzini Labs', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text(pdfText(`Analyses · ${periodLabel(range)} · ${new Date().toLocaleDateString('fr-FR')}`), M, y + 18);
  y += 48;
  for (const ds of list) {
    ensure(90);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text(pdfText(ds.title), M, y);
    y += 20;
    doc.setFontSize(20);
    doc.text(pdfText(`${ds.figure.value}${ds.figure.unit ? ` ${ds.figure.unit}` : ''}`), M, y);
    y += 16;
    const sub = [ds.figure.label, ds.figure.delta?.label, ds.figure.note].filter(Boolean).join(' · ');
    if (sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(pdfText(sub), M, y);
      y += 16;
    }
    const cols = ds.columns;
    const colW = (W - 2 * M) / Math.max(cols.length, 1);
    const row = (cells: string[], bold: boolean) => {
      ensure(16);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(bold ? 30 : 48, bold ? 30 : 48, bold ? 30 : 48);
      cells.forEach((c, i) => {
        const text = doc.splitTextToSize(pdfText(c), colW - 6)[0] ?? '';
        if (i === 0) doc.text(text, M + i * colW, y);
        else doc.text(text, M + (i + 1) * colW - 4, y, { align: 'right' });
      });
      y += 14;
      doc.setDrawColor(230, 230, 230);
      doc.line(M, y - 10, W - M, y - 10);
    };
    y += 4;
    row(cols.map((c) => c.label), true);
    for (const r of ds.rows) {
      row(cols.map((c) => {
        const v = r[c.key];
        return typeof v === 'number' ? v.toLocaleString('fr-FR') : String(v ?? '');
      }), false);
    }
    y += 18;
  }
  doc.save(exportFileName(single, range, 'pdf'));
}

const CAPTURE = { pixelRatio: 3, webkitWarmup: true } as const;

export async function savePng(node: HTMLElement, filename: string, dark: boolean): Promise<void> {
  const url = await captureNodePng(node, { ...CAPTURE, backgroundColor: dark ? '#1E1E1E' : '#FFFFFF' });
  triggerDownload(url, filename);
}

export async function copyPng(node: HTMLElement, filename: string, dark: boolean): Promise<CopyOutcome> {
  return copyNodePng(node, filename, { ...CAPTURE, backgroundColor: dark ? '#1E1E1E' : '#FFFFFF' });
}

/** La feuille de partage du téléphone ; à défaut, l'image est enregistrée. */
export async function sharePng(node: HTMLElement, filename: string, title: string, dark: boolean): Promise<'shared' | 'downloaded'> {
  const url = await captureNodePng(node, { ...CAPTURE, backgroundColor: dark ? '#1E1E1E' : '#FFFFFF' });
  const blob = await (await fetch(url)).blob();
  const file = typeof File !== 'undefined' ? new File([blob], filename, { type: 'image/png' }) : null;
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  if (file && nav?.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      // L'utilisateur a fermé la feuille : rien à faire.
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
    }
  }
  triggerDownload(url, filename);
  return 'downloaded';
}
