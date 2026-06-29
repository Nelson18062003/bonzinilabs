import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SURFACE, TEXT } from "@/mobile/designKit";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation('client');

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className={cn('flex min-h-screen items-center justify-center px-6', SURFACE.canvas)}>
      <div className="text-center">
        <h1 className={cn('mb-3 text-[44px] font-black leading-none', TEXT.strong)}>{t('notFound.title')}</h1>
        <p className={cn('mb-5 text-[15px]', TEXT.muted)}>{t('notFound.message')}</p>
        <a href="/" className="text-[14px] font-bold text-[#5B4CC4] underline underline-offset-4 transition hover:opacity-80 dark:text-[#B5AAF0]">
          {t('notFound.backHome')}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
