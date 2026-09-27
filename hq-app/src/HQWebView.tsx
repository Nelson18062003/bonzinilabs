// ============================================================
// Le site du personnel, DANS l'app — une seule WebView, jamais démontée :
// les onglets natifs y naviguent sans rechargement (routeur du site).
//
//   · Poignée (WebHandle) : naviguer, poser la session de la connexion
//     native, déconnecter, rendre un scan à l'écran qui l'attend.
//   · Messages du site (src/lib/nativeBridge.ts) : qui est connecté + jeton,
//     page courante, demandes d'ouverture/fermeture du scanner.
//   · Pages bonzinilabs.com dans l'app ; WhatsApp, appels, e-mails → apps
//     du téléphone ; autres sites → navigateur intégré.
//   · Fichiers, partage, presse-papiers : bridge.ts + files.ts.
//   · Bouton retour Android = page précédente ; plantage mémoire → rechargement.
// ============================================================
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { BackHandler, Linking, Platform } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewMessageEvent, WebViewOpenWindowEvent } from 'react-native-webview/lib/WebViewTypes';
import * as WebBrowser from 'expo-web-browser';
import { INJECTED_BEFORE_CONTENT, parseBridgeMessage, type BridgeMessage } from './bridge';
import { handleBridgeMessage } from './files';
import { START_URL, USER_AGENT_SUFFIX, isAppUrl } from './config';
import type { WebHandle } from './store';

type SiteMessage = Extract<BridgeMessage, { type: 'auth' | 'route' | 'scan-open' | 'scan-close' | 'theme' }>;

interface Props {
  /** Première page affichée : on peut retirer l'écran de lancement. */
  onFirstLoad: () => void;
  /** Échec réseau de la page principale. */
  onNetworkError: () => void;
  /** Ce que le site dit à l'app. */
  onSiteMessage: (msg: SiteMessage) => void;
  /** Retour Android sans page précédente : l'écran principal décide (revenir à l'accueil…). */
  onBackAtRoot?: () => boolean;
}

/** Hors de l'app : applications du téléphone (tel:, mailto:, whatsapp:…) ou navigateur intégré. */
export async function openOutside(url: string) {
  try {
    if (/^https?:/i.test(url)) {
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

/** Un appel au site, protégé : si le pont n'est pas encore prêt, on retente un peu plus tard. */
function callSite(expr: string): string {
  return `(function(){var n=0;function go(){if(window.__bonziniHQ){try{${expr}}catch(e){}}else if(n++<40){setTimeout(go,150);}}go();})();true;`;
}

export const HQWebView = forwardRef<WebHandle, Props>(function HQWebView({ onFirstLoad, onNetworkError, onSiteMessage, onBackAtRoot }, ref) {
  const web = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const loadedOnce = useRef(false);

  useImperativeHandle(ref, () => ({
    reload: () => web.current?.reload(),
    navigate: (path) => web.current?.injectJavaScript(callSite(`window.__bonziniHQ.navigate(${JSON.stringify(path)});`)),
    setSession: (tokens) => web.current?.injectJavaScript(callSite(`window.__bonziniHQ.setSession(${JSON.stringify(tokens)});`)),
    logout: () => web.current?.injectJavaScript(callSite('window.__bonziniHQ.logout();')),
    deliverScan: (text) => web.current?.injectJavaScript(callSite(`window.__bonziniHQ.deliverScan(${JSON.stringify(text)});`)),
  }), []);

  // Android : le bouton retour revient à la page précédente avant de quitter.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        web.current?.goBack();
        return true;
      }
      return onBackAtRoot ? onBackAtRoot() : false;
    });
    return () => sub.remove();
  }, [canGoBack, onBackAtRoot]);

  const onShouldStart = useCallback((req: ShouldStartLoadRequest) => {
    const { url } = req;
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
    // Seules les pages bonzinilabs.com parlent à l'app (session, fichiers…).
    if (!isAppUrl(e.nativeEvent.url)) return;
    const msg = parseBridgeMessage(e.nativeEvent.data);
    if (!msg) return;
    if (msg.type === 'auth' || msg.type === 'route' || msg.type === 'scan-open' || msg.type === 'scan-close' || msg.type === 'theme') {
      onSiteMessage(msg);
      return;
    }
    void handleBridgeMessage(msg, (url) => void openOutside(url));
  }, [onSiteMessage]);

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
      onContentProcessDidTerminate={() => web.current?.reload()}
      onRenderProcessGone={() => web.current?.reload()}
      originWhitelist={['https://*', 'about:*', 'blob:*', 'data:*']}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled
      mediaCapturePermissionGrantType="grant"
      allowsInlineMediaPlayback
      allowsBackForwardNavigationGestures
      allowsLinkPreview={false}
      setSupportMultipleWindows
      textZoom={100}
      overScrollMode="never"
      contentInsetAdjustmentBehavior="never"
      keyboardDisplayRequiresUserAction={false}
      webviewDebuggingEnabled={__DEV__}
      style={{ flex: 1, backgroundColor: 'transparent' }}
    />
  );
});
