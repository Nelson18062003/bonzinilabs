// ============================================================
// L'écran principal : le site du personnel, dans l'app.
//
//   · Les pages bonzinilabs.com restent DANS l'app ; tout autre lien part
//     là où il doit aller : WhatsApp, appel, e-mail → l'app du téléphone ;
//     autre site (preuve stockée, carte…) → navigateur intégré.
//   · Fichiers, partage, presse-papiers : voir bridge.ts et files.ts.
//   · Bouton retour Android = page précédente ; balayage retour sur iPhone.
//   · Caméra : autorisée pour le site (scanner les codes clients et cartons).
//   · Si la page plante (mémoire), on la recharge au lieu d'un écran blanc.
// ============================================================
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { BackHandler, Linking, Platform } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewMessageEvent, WebViewOpenWindowEvent } from 'react-native-webview/lib/WebViewTypes';
import * as WebBrowser from 'expo-web-browser';
import { INJECTED_BEFORE_CONTENT, parseBridgeMessage } from './bridge';
import { handleBridgeMessage } from './files';
import { START_URL, USER_AGENT_SUFFIX, isAppUrl } from './config';

export interface HQWebViewHandle {
  reload: () => void;
}

interface Props {
  /** Première page affichée : on peut retirer l'écran de lancement. */
  onFirstLoad: () => void;
  /** Échec réseau de la page principale. */
  onNetworkError: () => void;
  /** Couleur de fond de la page (pour peindre les bords de l'écran). */
  onTheme: (background: string) => void;
}

/** Hors de l'app : applications du téléphone (tel:, mailto:, whatsapp:…) ou navigateur intégré. */
async function openOutside(url: string) {
  try {
    if (/^https?:/i.test(url)) {
      // wa.me et api.whatsapp.com ouvrent WhatsApp directement.
      if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(url)) {
        await Linking.openURL(url);
        return;
      }
      await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
      return;
    }
    await Linking.openURL(url);
  } catch {
    // Aucune app ne sait ouvrir ce lien : on ne fait rien plutôt que de planter.
  }
}

export const HQWebView = forwardRef<HQWebViewHandle, Props>(function HQWebView({ onFirstLoad, onNetworkError, onTheme }, ref) {
  const web = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const loadedOnce = useRef(false);

  useImperativeHandle(ref, () => ({ reload: () => web.current?.reload() }), []);

  // Android : le bouton retour revient à la page précédente avant de quitter.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        web.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onShouldStart = useCallback((req: ShouldStartLoadRequest) => {
    const { url } = req;
    // Cadres intégrés (aperçus, captcha…) : laissés au site.
    if (req.isTopFrame === false) return true;
    if (url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) return true;
    if (isAppUrl(url)) return true;
    void openOutside(url);
    return false;
  }, []);

  const onOpenWindow = useCallback((e: WebViewOpenWindowEvent) => {
    const url = e.nativeEvent.targetUrl;
    if (isAppUrl(url)) web.current?.injectJavaScript(`window.location.assign(${JSON.stringify(url)}); true;`);
    else void openOutside(url);
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    const msg = parseBridgeMessage(e.nativeEvent.data);
    if (!msg) return;
    if (msg.type === 'theme') {
      onTheme(msg.background);
      return;
    }
    void handleBridgeMessage(msg, (url) => void openOutside(url));
  }, [onTheme]);

  const onNav = useCallback((nav: WebViewNavigation) => setCanGoBack(nav.canGoBack), []);

  return (
    <WebView
      ref={web}
      source={{ uri: START_URL }}
      applicationNameForUserAgent={USER_AGENT_SUFFIX}
      injectedJavaScriptBeforeContentLoaded={INJECTED_BEFORE_CONTENT}
      injectedJavaScriptBeforeContentLoadedForMainFrameOnly
      onMessage={onMessage}
      onShouldStartLoadWithRequest={onShouldStart}
      onOpenWindow={onOpenWindow}
      onNavigationStateChange={onNav}
      onLoadEnd={() => {
        if (!loadedOnce.current) {
          loadedOnce.current = true;
          onFirstLoad();
        }
      }}
      onError={() => onNetworkError()}
      // Mémoire saturée (grosses images, PDF) : on recharge plutôt qu'un écran blanc.
      onContentProcessDidTerminate={() => web.current?.reload()}
      onRenderProcessGone={() => web.current?.reload()}
      originWhitelist={['https://*', 'about:*', 'blob:*', 'data:*']}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled
      // Caméra du scanner : accordée au site sans seconde question (la permission du téléphone suffit).
      mediaCapturePermissionGrantType="grant"
      allowsInlineMediaPlayback
      allowsBackForwardNavigationGestures
      allowsLinkPreview={false}
      setSupportMultipleWindows
      // Taille du texte : celle du site, pas un zoom Android qui casse les écrans.
      textZoom={100}
      overScrollMode="never"
      contentInsetAdjustmentBehavior="never"
      keyboardDisplayRequiresUserAction={false}
      webviewDebuggingEnabled={__DEV__}
      style={{ flex: 1, backgroundColor: 'transparent' }}
    />
  );
});
