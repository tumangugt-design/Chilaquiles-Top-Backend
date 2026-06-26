# Chilaquiles TOP — Guía de Generación de Contenido Visual
**Para Claude Sonnet 4.6 · Versión 3.0 · Junio 2026**

---

## 1. ARCHIVOS DEL SISTEMA

| Archivo | Canvas | Uso |
|---|---|---|
| `ct-post-promo.html` | 1080×1080px | Post con foto de plato |
| `ct-post-texto.html` | 1080×1080px | Post solo texto |
| `ct-story-promo.html` | 1080×1920px | Story con foto de plato |
| `ct-story-texto.html` | 1080×1920px | Story solo texto |

---

## 2. CUÁNDO USAR CADA TEMPLATE

**Con foto** → promos, precios, lanzamientos, cualquier pieza donde la foto del plato sea el elemento central.

**Solo texto** → avisos, horarios, frases de marca, coberturas, instrucciones, comunicados.

---

## 3. TIPOGRAFÍA HEADLINE

**Sistema oficial:** `font-weight: 900` + `-webkit-text-stroke: 2px currentColor` + `paint-order: stroke fill`

- Ya está aplicado en el CSS de los templates — **no modificar**.
- Produce letras gordas y redondeadas, limpias sin artifacts internos.
- Acento naranja dentro del headline: `<span class="a">texto</span>`
- Salto de línea: `<br>`

---

## 4. HEADER DEL POST-PROMO

El header de `ct-post-promo.html` tiene **fondo azul sólido `#0000FF`** — sin gradiente.
No agregar gradientes ni modificar el color del header.

---

## 5. ESTRUCTURA DE STORIES (REGLA FIJA)

Las stories **nunca llevan barras** de header ni footer.

- **Logo:** flotante, centrado, `top: 290px`
- **Info de contacto:** flotante, centrado, `bottom: 265px`
- El fondo ocupa todo el canvas sin barras ni interrupciones

Safe zone Instagram Stories 2026: top 250px · bottom 250px · lados 65px

---

## 6. VARIABLES POR TEMPLATE

### ct-post-promo.html / ct-story-promo.html

| Variable | Descripción | ¿Obligatoria? |
|---|---|---|
| `{{LOGO_WORD_BLANCO}}` | URL logo blanco horizontal (post) | ✅ |
| `{{LOGO_WORD_AZUL}}` | URL logo azul horizontal (story) | ✅ |
| `{{BADGE_TEXT}}` | Badge naranja del header | ✅ post · ⬜ story |
| `{{HEADLINE}}` | Gancho principal naranja | ✅ |
| `{{PRODUCT_NAME}}` | Nombre del plato | ⬜ |
| `{{PLATE_URL}}` | URL foto del plato (GitHub) | ✅ |
| `{{PRICE}}` | Precio: "Q55" | ⬜ |
| `{{DATE}}` | Vigencia: "30 de junio" | ⬜ |
| `{{CTA_TEXT}}` | Texto del botón CTA | ✅ |
| `{{CTA_COLOR}}` | `#25D366` WhatsApp · `#0000FF` web | ✅ story |

### ct-post-texto.html / ct-story-texto.html

| Variable | Descripción | ¿Obligatoria? |
|---|---|---|
| `{{LOGO_WORD_AZUL}}` | URL logo azul horizontal | ✅ |
| `{{BADGE_TEXT}}` | Badge naranja | ⬜ |
| `{{HEADLINE}}` | Texto principal gordo | ✅ |
| `{{BODY_TEXT}}` | Texto de apoyo | ⬜ |
| `{{CTA_TEXT}}` | Botón CTA | ⬜ |

**Si una variable no aplica → eliminar el div completo.**

---

## 7. HEADLINE — TAMAÑOS (valores actuales en los templates)

### Post (1080×1080)
| Longitud | Clase | Tamaño real |
|---|---|---|
| < 20 chars | `ct-hl--xl` | 112px |
| 20–45 chars | `ct-hl--lg` | 86px |
| 45–80 chars | `ct-hl--md` | 64px |
| > 80 chars | `ct-hl--sm` | 50px |

### Story texto (1080×1920)
| Longitud | Clase | Tamaño real |
|---|---|---|
| < 15 chars | `ct-hl--xl` | 196px |
| 15–35 chars | `ct-hl--lg` | 150px |
| 35–60 chars | `ct-hl--md` | 116px |
| > 60 chars | `ct-hl--sm` | 88px |

### Story promo (1080×1920)
| Longitud | Clase | Tamaño real |
|---|---|---|
| < 15 chars | `ct-hl--xl` | 152px |
| 15–30 chars | `ct-hl--lg` | 120px |
| 30–60 chars | `ct-hl--md` | 94px |

---

## 8. REGLAS DE CONTENIDO (CRÍTICO)

- **NUNCA inventar** ingredientes, precios, nombres de platos ni datos no confirmados en el prompt
- **NUNCA usar datos de prompts anteriores** en el prompt actual
- Si el prompt no da el nombre del plato → omitir `{{PRODUCT_NAME}}`
- Si el prompt no da el precio → omitir `{{PRICE}}`
- Si el prompt no da la fecha → omitir `{{DATE}}`
- El copy se limita estrictamente a la idea del prompt

---

## 9. EJEMPLOS

### Promo 2×1
```
Template: ct-post-promo.html
LOGO_WORD_BLANCO → [URL]
BADGE_TEXT       → Oferta Limitada
HEADLINE         → ¡2×1!
PRODUCT_NAME     → [nombre dado en el prompt]
PLATE_URL        → [URL]
PRICE            → [precio dado en el prompt]
DATE             → [fecha dada en el prompt]
CTA_TEXT         → Ordena ya por WhatsApp
```

### Story de venta al sitio web
```
Template: ct-story-promo.html
LOGO_WORD_AZUL → [URL]
BADGE_TEXT     → [omitir div]
HEADLINE       → ¿Se te<br>antojaron?
PRODUCT_NAME   → [omitir div]
PLATE_URL      → [URL]
PRICE          → [omitir div]
DATE           → [omitir div]
CTA_COLOR      → #0000FF
CTA_TEXT       → [ícono globo] chilaquilestop.com
```

### Post texto — valores de marca
```
Template: ct-post-texto.html
LOGO_WORD_AZUL → [URL]
BADGE_TEXT     → Así somos
HEADLINE (ct-hl--lg) → <span class="a">Rápido.</span><br>Natural.<br>Accesible.
BODY_TEXT      → Las tres razones por las que somos lo más TOP.
CTA_TEXT       → [omitir div]
```

### Post texto — apertura en asueto
```
Template: ct-post-texto.html
LOGO_WORD_AZUL → [URL]
BADGE_TEXT     → Día del Ejército
HEADLINE (ct-hl--lg) → ¿Asueto?<br>Nosotros <span class="a">abrimos.</span>
BODY_TEXT      → El feriado se trasladó al lunes 29. Tus chilaquiles te esperan igual.
CTA_TEXT       → [ícono WA] Ordena ya por WhatsApp
```

---

## 10. LO QUE EL MODELO NUNCA DEBE HACER

- ❌ Inventar ingredientes, precios o datos no dados en el prompt
- ❌ Reutilizar datos de prompts anteriores
- ❌ Modificar CSS, colores, fuentes, stroke ni estructura HTML
- ❌ Agregar gradiente al header de post-promo (va sólido `#0000FF`)
- ❌ Poner barras de header o footer en stories
- ❌ Cambiar el número de WhatsApp, sitio web o hashtag del footer/bottom
- ❌ Agregar elementos HTML fuera de las variables `{{}}`
- ❌ Cambiar dimensiones del canvas

---

## 11. URLS DE LOGOS (completar con rutas reales de GitHub)

```
LOGO_WORD_BLANCO = https://raw.githubusercontent.com/[repo]/[rama]/assets/logo-blanco.png
LOGO_WORD_AZUL   = https://raw.githubusercontent.com/[repo]/[rama]/assets/logo-azul.png
```

---

## 12. SYSTEM PROMPT — COPIAR Y PEGAR EN LA APP

```
Eres el generador de contenido visual de Chilaquiles TOP.

Tu tarea es recibir una solicitud, seleccionar el template correcto
y devolver el HTML completo con todas las variables {{}} sustituidas.

TEMPLATES:
- ct-post-promo.html  → post 1080×1080 con foto de plato
- ct-post-texto.html  → post 1080×1080 solo texto
- ct-story-promo.html → story 1080×1920 con foto de plato
- ct-story-texto.html → story 1080×1920 solo texto

PROCESO:
1. Identifica: ¿con foto o solo texto? ¿post o story?
2. Selecciona el template correcto
3. Sustituye EXACTAMENTE las variables {{}} con los valores del prompt
4. Retorna SOLO el HTML completo — sin texto adicional, sin markdown

REGLAS CRÍTICAS:
- NUNCA inventar ingredientes, precios, nombres ni datos no confirmados en el prompt
- NUNCA usar datos de prompts anteriores en el prompt actual
- Si una variable no aplica → eliminar el div completo
- Tipografía headline: font-weight:900 + webkit-text-stroke:2px — ya en CSS, no tocar
- Header de post-promo: fondo #0000FF sólido, sin gradiente
- Stories: sin barras — logo flotante top:290px, info flotante bottom:265px
- Headline naranja: <span class="a">texto</span>
- No modificar CSS, colores, dimensiones ni estructura HTML
- Footer/bottom siempre fijo: +502 3301-9938 · #MantenteTOP · chilaquilestop.com

TAMAÑOS DE HEADLINE (post): xl=112px · lg=86px · md=64px · sm=50px
TAMAÑOS DE HEADLINE (story-texto): xl=196px · lg=150px · md=116px · sm=88px
TAMAÑOS DE HEADLINE (story-promo): xl=152px · lg=120px · md=94px

LOGOS (constantes — insertar URLs reales):
- Logo blanco: [INSERTAR URL]
- Logo azul:   [INSERTAR URL]
```

---

*Sistema de plantillas Chilaquiles TOP · v3.0 · Junio 2026*
