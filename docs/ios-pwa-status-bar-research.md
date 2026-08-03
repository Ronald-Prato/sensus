# Status bar de una PWA instalada en iOS

Investigación realizada el 2 de agosto de 2026, limitada a documentación oficial de Apple, WebKit y estándares web.

## Conclusión breve

Sí es posible que la textura de la página se vea detrás de la status bar de una web app instalada desde Safari, pero no se asigna una imagen a la status bar. La combinación soportada es:

1. abrir la instalación como web app/standalone;
2. declarar `apple-mobile-web-app-status-bar-style=black-translucent`;
3. usar `viewport-fit=cover`; y
4. pintar la textura de la propia página hasta el borde superior, dejando el `safe-area-inset-top` solo como espacio para el contenido interactivo.

iOS conserva el control de los iconos, contraste y capa translúcida de la status bar. No hay una API web oficial para ponerle una imagen directamente ni para ocultarla de forma fiable. Además, WebKit ha tenido regresiones por versión en esta zona, por lo que el resultado debe verificarse en el dispositivo y versión objetivo.

## Requisitos y límites

### Modo web app

Apple documenta que `<meta name="apple-mobile-web-app-capable" content="yes">` activa el modo standalone y elimina la interfaz de Safari, dejando la status bar del sistema. `window.navigator.standalone` permite comprobar ese modo. El tag de estilo de la status bar no tiene efecto si antes no se habilitó ese modo ([Apple, Supported Meta Tags](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html); [Apple, Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)).

Un manifest con `"display": "standalone"` o `"display": "fullscreen"` también hace que una instalación de Home Screen se abra como web app en iOS/iPadOS ([WebKit, Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). Desde iOS/iPadOS 26 cualquier sitio puede agregarse como web app y el usuario puede desactivar **Open as Web App** al instalar; WebKit aclara que el manifest y las capacidades existentes siguen aplicándose ([WebKit, Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)).

El estándar define `standalone` como un modo sin UI normal del navegador que todavía puede incluir UI del sistema, incluida una status bar. `fullscreen` pide ocupar toda el área disponible, pero los modos son convenciones y su interpretación queda en manos del navegador; además, `fullscreen` cae a `standalone` si no se soporta ([W3C, Web Application Manifest: display modes](https://www.w3.org/TR/appmanifest/#display-modes)). Por eso `fullscreen` no es una forma portable ni garantizada de ocultar la status bar de iOS.

### `black-translucent` y la textura

Apple solo define tres valores para `apple-mobile-web-app-status-bar-style`:

- `default`: status bar normal; el contenido comienza debajo;
- `black`: fondo negro opaco; el contenido comienza debajo;
- `black-translucent`: barra negra translúcida; el contenido web ocupa toda la pantalla y queda parcialmente cubierto por la status bar.

La tercera opción es la única de estas tres que permite ver el contenido de la página detrás de la barra ([Apple, Supported Meta Tags](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html#//apple_ref/doc/uid/TP40008193-SW4)). No garantiza que la textura conserve su color exacto: la capa translúcida y los indicadores son del sistema.

`theme_color`, tanto en manifest como en `<meta name="theme-color">`, solo acepta un color CSS; el navegador puede ignorar transparencia. `background_color` también es un color y está destinado al fondo previo a que cargue el CSS, no a sustituir el fondo real de la aplicación ([W3C, `theme_color`](https://www.w3.org/TR/appmanifest/#theme_color-member); [W3C, `background_color`](https://www.w3.org/TR/appmanifest/#background_color-member)). Ninguno admite una imagen o textura.

Para que el DOM llegue al borde físico, WebKit documenta `viewport-fit=cover`. Después deben aplicarse `env(safe-area-inset-*)` a controles y texto para evitar notch, esquinas e indicador de inicio; el fondo no debe quedar recortado por ese padding ([WebKit, Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)).

### Cuándo se leen los metadatos

Los tags de Apple son metadata de instalación/lanzamiento: Apple indica colocarlos en la página y describe su efecto cuando la web app se abre desde Home Screen. WebKit también describe la presencia del meta tag o del `display` del manifest como la configuración usada para decidir el comportamiento de la instalación ([Apple, Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html); [WebKit, Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)). No existe un contrato oficial que garantice que insertar o cambiar mediante React, después del arranque, `apple-mobile-web-app-capable` o `apple-mobile-web-app-status-bar-style` reconfigure la ventana ya creada.

El propio procesamiento dinámico de `<meta>` de WebKit enumera casos como `viewport` y `theme-color`, pero no esos dos tags de web app de Apple ([WebKit, `HTMLMetaElement.cpp`](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/HTMLMetaElement.cpp#L943-L1021)). Por tanto, deben estar en el `<head>` del HTML inicial, antes de instalar y en cada documento de entrada, no depender del montaje de una pantalla o componente cliente.

El manifest tiene un ciclo diferente: el estándar indica que se obtiene y procesa en cada carga, pero deja como opcional que el navegador aplique la actualización a contextos instalados actuales o futuros ([W3C, Updating the manifest](https://www.w3.org/TR/appmanifest/#dfn-updating-the-manifest)). Para validar cambios de metadata de forma determinista en iOS conviene eliminar la instalación anterior, volver a abrir el sitio en Safari y agregarlo otra vez a Home Screen; el estándar no garantiza una actualización inmediata de la instalación existente.

## Aplicación a Expo Router en Sensus

Estado observado en el repositorio:

- `src/components/Primitives.tsx` inserta `theme-color` y `apple-mobile-web-app-status-bar-style` desde `PaperScreen`, es decir, desde un componente de pantalla.
- No aparece `apple-mobile-web-app-capable=yes`.
- No aparece `viewport-fit=cover`.
- No hay un manifest enlazado con `display: standalone` o `fullscreen`.
- `src/app/_layout.tsx` solo aporta los iconos dentro de `Head`.
- `StatusBar` de React Native/Expo no sustituye los metadatos que controla la ventana de una PWA de iOS.

Configuración recomendada para una corrección posterior:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="/manifest.webmanifest">
```

```json
{
  "display": "standalone",
  "theme_color": "#fondo-solido-de-respaldo",
  "background_color": "#fondo-solido-de-respaldo"
}
```

En Expo Router estos elementos deben salir del documento HTML raíz (por ejemplo, mediante `src/app/+html.tsx`) para estar en el `<head>` inicial de todas las rutas. No deben depender de `PaperScreen`. Debe existir un solo meta viewport, incorporando `viewport-fit=cover`, en vez de metas viewport competidores.

La textura debe pintarse en una capa que cubra el viewport completo (`html`, `body`, raíz y fondo con altura mínima del viewport dinámico). El padding `env(safe-area-inset-top)` se aplica al contenedor de header/contenido, no a la capa de textura. Así el fondo continúa debajo de la status bar mientras los controles quedan dentro del área segura.

## Limitaciones conocidas de WebKit

El tracker oficial registra regresiones donde iOS dejó una franja opaca inaccesible al DOM aun con `viewport-fit=cover`, y otras donde una navegación SPA cambia el fondo de la status bar; esto confirma que no hay garantía absoluta entre versiones ([WebKit bug 301994](https://bugs.webkit.org/show_bug.cgi?id=301994); [WebKit bug 305546](https://bugs.webkit.org/show_bug.cgi?id=305546)). Si la combinación correcta aparece en el HTML inicial y el DOM llega hasta arriba, pero una versión concreta sigue mostrando una franja blanca, puede ser una limitación/regresión de iOS y no algo corregible con otro color o imagen en el manifest.
