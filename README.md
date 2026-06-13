# RotaInteligente

Aplicativo **offline-first** de Gestão e Inteligência de Viagem, construído com HTML5, CSS3 e JavaScript ES6+ (Vanilla). Persistência 100% local via `localStorage`, sem backend.

Ideal para registrar gastos em estrada, calcular métricas (KM/L, custo por KM, diária) e preparar reviews para o Google Maps após encerrar a viagem.

---

## Funcionalidades

- Dashboard com total acumulado, métricas inteligentes e gráfico de rosca (Chart.js)
- Lançamento dinâmico por categoria (Combustível, Alimentação, Hospedagem, Pedágio, Outros)
- Histórico cronológico com exclusão de itens
- Central de Postagem para reviews formatados (pós-viagem)
- Parsing numérico no padrão brasileiro (`1.234,56`)
- Captura de GPS (navegador ou app nativo Android via Capacitor)

---

## Estrutura do Projeto (MVC + ES6 Modules)

```
app_gastos/
├── index.html                    # Ponto de entrada único (SPA)
├── css/
│   ├── variables.css             # Design tokens (cores, espaçamentos, dark mode)
│   ├── main.css                  # Reset, layout base, Bottom Nav, modais
│   └── components/
│       ├── dashboard.css
│       ├── formulario.css
│       ├── historico.css
│       └── postagem.css
├── js/
│   ├── app.js                    # Bootstrap, roteador de abas, injeção de DI
│   ├── models/
│   │   └── ViagemManager.js      # Model — persistência e motor de cálculos
│   ├── controllers/
│   │   ├── DashController.js     # Dashboard, histórico e ciclo de viagens
│   │   ├── FormController.js     # Formulário dinâmico e lançamento
│   │   └── PostController.js     # Central de postagem e reviews
│   └── utils/
│       ├── formatters.js         # Parsing BR, moeda, datas
│       └── geo.js                # Geolocalização (Web + Capacitor)
├── scripts/sync-web.js           # Copia assets → www/ (Capacitor)
├── www/                          # Gerado automaticamente
├── android/                      # Projeto Android (Capacitor)
├── capacitor.config.json
├── package.json
└── README.md
```

### Arquitetura

| Camada | Responsabilidade |
|--------|------------------|
| **Model** | `ViagemManager` — localStorage, CRUD, métricas puras |
| **View** | `index.html` + CSS modular |
| **Controller** | `DashController`, `FormController`, `PostController` — DOM e eventos |
| **Utils** | Formatação numérica BR e geolocalização |
| **App** | Singleton do Model + roteamento SPA |

---

## Requisitos

| Ambiente | Versão mínima |
|----------|----------------|
| Navegador moderno | Chrome, Firefox, Safari, Edge (suporte ES6+) |
| Node.js (Capacitor) | 18+ |
| Android Studio (APK) | Hedgehog (2023.1.1)+ |
| JDK | 17 |

---

## Executar no Navegador (desenvolvimento local)

### XAMPP (Windows)

1. Coloque o projeto em `C:\xampp\htdocs\app_gastos\`
2. Inicie Apache no XAMPP
3. Acesse: [http://localhost/app_gastos/](http://localhost/app_gastos/)

### Servidor estático simples

```bash
npx serve .
```

---

## Publicar no GitHub Pages

### 1. Criar repositório no GitHub

```bash
git init
git add .
git commit -m "feat: RotaInteligente — app offline-first de viagem"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/app_gastos.git
git push -u origin main
```

### 2. Ativar GitHub Pages

1. No GitHub: **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` → pasta **`/ (root)`**
4. Salve e aguarde alguns minutos

A URL ficará:

```
https://SEU_USUARIO.github.io/app_gastos/
```

### 3. Observações importantes

- Os caminhos dos assets são **relativos** (`style.css`, `app.js`), compatíveis com subpastas do Pages.
- O Chart.js é carregado via CDN (requer internet na primeira carga).
- Os dados ficam no `localStorage` do navegador — cada dispositivo/navegador tem sua própria base.

### Deploy automático (opcional)

Crie `.github/workflows/pages.yml`:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - uses: actions/deploy-pages@v4
```

---

## Capacitor.js — App Android Nativo

O Capacitor encapsula o app web em um WebView Android, mantendo o mesmo código HTML/CSS/JS.

### Instalação (primeira vez)

```bash
npm install
```

### Comandos disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run cap:sync` | Copia assets web → `www/` e sincroniza com Android |
| `npm run cap:open:android` | Abre o projeto no Android Studio |
| `npm run cap:run:android` | Sincroniza e executa no emulador/dispositivo |
| `npm run cap:build:android` | Gera APK de debug |

### Fluxo de desenvolvimento

1. Edite os arquivos na **raiz** (`index.html`, `app.js`, `style.css`, `viagemManager.js`)
2. Sincronize com o projeto nativo:

```bash
npm run cap:sync
```

3. Abra no Android Studio:

```bash
npm run cap:open:android
```

4. No Android Studio: **Run ▶** (emulador ou dispositivo USB com depuração ativada)

### Gerar APK de debug

```bash
npm run cap:build:android
```

O APK estará em:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Permissões Android (GPS)

O app usa geolocalização para registrar coordenadas nos gastos. As permissões já estão configuradas em:

`android/app/src/main/AndroidManifest.xml`

- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`

No dispositivo, conceda permissão de localização quando solicitado.

### App ID e nome

| Campo | Valor |
|-------|-------|
| App ID | `com.rotainteligente.app` |
| Nome | `RotaInteligente` |
| webDir | `www/` (gerado por `scripts/sync-web.js`) |

Para alterar o App ID, edite `capacitor.config.json` e execute `npm run cap:sync`.

---

## Persistência de Dados

Chave no `localStorage`:

```
rota_inteligente_data
```

Estrutura JSON:

```json
{
  "viagens": [
    {
      "id": "string_unica",
      "nome": "Road Trip Sul",
      "veiculo": "carro",
      "status": "ativa",
      "kmInicial": 45000,
      "kmFinal": null,
      "gastos": []
    }
  ]
}
```

---

## Métricas calculadas

| Métrica | Fórmula |
|---------|---------|
| Total Geral | Soma de todos os gastos |
| Consumo KM/L | `(kmFinal - kmInicial) / Σ litros` |
| Custo por Diária | `Σ hospedagem / Σ diárias` |
| Alimentação per Capita | `Σ alimentação / Σ pessoas` |
| Custo por KM | `(Σ combustível + Σ pedágios) / distância` |

---

## Licença

Projeto de uso livre para fins educacionais e pessoais.

---

## Créditos

- [Chart.js](https://www.chartjs.org/) — gráficos
- [Capacitor](https://capacitorjs.com/) — encapsulamento Android
