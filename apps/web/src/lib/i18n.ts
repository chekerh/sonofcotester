export type SupportedLanguage = "en" | "ja" | "de" | "fr" | "es";

export interface TranslationDictionary {
  appName: string;
  prodReady: string;
  liveStream: string;
  connecting: string;
  commandPalette: string;
  runSmoke: string;
  newProject: string;
  publicStorefront: string;
  tabs: {
    testing: string;
    health: string;
    maestro: string;
    academy: string;
    admin: string;
    benchmark: string;
  };
  inspector: {
    targetApp: string;
    headline: string;
    desc: string;
    inputPlaceholder: string;
    crawlButton: string;
    crawling: string;
    generateTests: string;
    executeSuite: string;
    buttons: string;
    inputs: string;
    links: string;
    headings: string;
    wcagScore: string;
  };
  auth: {
    login: string;
    register: string;
    logout: string;
    role: string;
    workspace: string;
  };
}

export const translations: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    appName: "son of cotester",
    prodReady: "PROD READY",
    liveStream: "Live Stream",
    connecting: "Connecting...",
    commandPalette: "Command Palette",
    runSmoke: "Run Smoke Test",
    newProject: "New Project",
    publicStorefront: "Public Storefront",
    tabs: {
      testing: "Test Console",
      health: "Health Monitor",
      maestro: "Maestro Studio",
      academy: "Student Academy",
      admin: "Admin & Subscriptions",
      benchmark: "Capacity & Shootout"
    },
    inspector: {
      targetApp: "Target Application",
      headline: "Target App Inspector & Zero-Code Discovery",
      desc: "Point Son of CoTester to any local dev server or web URL. Playwright crawls interactive elements, captures a live snapshot, and generates resilient test flows.",
      inputPlaceholder: "Enter target URL (e.g. http://localhost:3000 or https://myapp.com)",
      crawlButton: "Inspect & Crawl Target",
      crawling: "Crawling App...",
      generateTests: "Generate Tests from Crawled Elements",
      executeSuite: "Execute Suite on Target",
      buttons: "Buttons",
      inputs: "Inputs",
      links: "Links",
      headings: "Headings",
      wcagScore: "WCAG AA"
    },
    auth: {
      login: "Log In",
      register: "Sign Up",
      logout: "Log Out",
      role: "Role",
      workspace: "Workspace"
    }
  },
  ja: {
    appName: "son of cotester",
    prodReady: "本番稼働可能",
    liveStream: "ライブストリーム",
    connecting: "接続中...",
    commandPalette: "コマンドパレット",
    runSmoke: "スモークテスト実行",
    newProject: "新規プロジェクト",
    publicStorefront: "ストアフロント",
    tabs: {
      testing: "テストコンソール",
      health: "ヘルスモニター",
      maestro: "Maestro スタジオ",
      academy: "アカデミー",
      admin: "管理・サブスクリプション",
      benchmark: "ベンチマーク＆言語比較"
    },
    inspector: {
      targetApp: "対象アプリケーション",
      headline: "アプリインスペクター＆ノーコード自動検出",
      desc: "任意のローカルサーバーまたはWeb URLを指定。Playwrightが要素を走査し、リアルタイムキャプチャと堅牢なテストフローを自動生成します。",
      inputPlaceholder: "対象URLを入力 (例: http://localhost:3000 または https://myapp.com)",
      crawlButton: "対象を検査・クロール",
      crawling: "クロール中...",
      generateTests: "検出要素からテストを自動生成",
      executeSuite: "スイートを実行",
      buttons: "ボタン",
      inputs: "入力欄",
      links: "リンク",
      headings: "見出し",
      wcagScore: "WCAG AA適合"
    },
    auth: {
      login: "ログイン",
      register: "登録",
      logout: "ログアウト",
      role: "権限",
      workspace: "ワークスペース"
    }
  },
  de: {
    appName: "son of cotester",
    prodReady: "PROD BEREIT",
    liveStream: "Live-Stream",
    connecting: "Verbinde...",
    commandPalette: "Befehlspalette",
    runSmoke: "Smoke-Test starten",
    newProject: "Neues Projekt",
    publicStorefront: "Öffentliche Storefront",
    tabs: {
      testing: "Test-Konsole",
      health: "Zustand-Monitor",
      maestro: "Maestro Studio",
      academy: "Akademie",
      admin: "Admin & Abos",
      benchmark: "Kapazität & Benchmark"
    },
    inspector: {
      targetApp: "Ziel-Anwendung",
      headline: "Ziel-App Inspektor & Zero-Code Erkennung",
      desc: "Geben Sie einen lokalen Entwicklungsserver oder eine Web-URL an. Playwright crawlt interaktive Elemente und generiert robuste Testabläufe.",
      inputPlaceholder: "Ziel-URL eingeben (z. B. http://localhost:3000 oder https://myapp.de)",
      crawlButton: "Ziel inspizieren & crawlen",
      crawling: "App wird gecrawlt...",
      generateTests: "Tests aus Elementen generieren",
      executeSuite: "Suite auf Ziel ausführen",
      buttons: "Schaltflächen",
      inputs: "Eingaben",
      links: "Links",
      headings: "Überschriften",
      wcagScore: "WCAG AA"
    },
    auth: {
      login: "Anmelden",
      register: "Registrieren",
      logout: "Abmelden",
      role: "Rolle",
      workspace: "Arbeitsbereich"
    }
  },
  fr: {
    appName: "son of cotester",
    prodReady: "PRÊT POUR PROD",
    liveStream: "Flux en direct",
    connecting: "Connexion...",
    commandPalette: "Palette de commandes",
    runSmoke: "Lancer test Smoke",
    newProject: "Nouveau Projet",
    publicStorefront: "Vitrine Publique",
    tabs: {
      testing: "Console de Test",
      health: "Moniteur de Santé",
      maestro: "Studio Maestro",
      academy: "Académie",
      admin: "Admin & Abonnements",
      benchmark: "Capacité & Benchmark"
    },
    inspector: {
      targetApp: "Application Cible",
      headline: "Inspecteur d'App & Découverte Zéro-Code",
      desc: "Pointez Son of CoTester vers n'importe quel serveur local ou URL. Playwright explore les éléments et génère des suites de tests résilientes.",
      inputPlaceholder: "Entrez l'URL cible (ex: http://localhost:3000 ou https://myapp.fr)",
      crawlButton: "Inspecter & Explorer",
      crawling: "Exploration en cours...",
      generateTests: "Générer les tests depuis le DOM",
      executeSuite: "Exécuter sur la cible",
      buttons: "Boutons",
      inputs: "Champs",
      links: "Liens",
      headings: "Titres",
      wcagScore: "WCAG AA"
    },
    auth: {
      login: "Connexion",
      register: "S'inscrire",
      logout: "Déconnexion",
      role: "Rôle",
      workspace: "Espace de travail"
    }
  },
  es: {
    appName: "son of cotester",
    prodReady: "LISTO PARA PROD",
    liveStream: "Transmisión en Vivo",
    connecting: "Conectando...",
    commandPalette: "Paleta de Comandos",
    runSmoke: "Ejecutar Test Smoke",
    newProject: "Nuevo Proyecto",
    publicStorefront: "Tienda Pública",
    tabs: {
      testing: "Consola de Pruebas",
      health: "Monitor de Salud",
      maestro: "Estudio Maestro",
      academy: "Academia",
      admin: "Admin y Suscripciones",
      benchmark: "Capacidad y Benchmark"
    },
    inspector: {
      targetApp: "Aplicación Objetivo",
      headline: "Inspector de App y Descubrimiento Sin Código",
      desc: "Apunte Son of CoTester a cualquier servidor local o URL. Playwright rastrea elementos interactivos y genera pruebas automatizadas resilientes.",
      inputPlaceholder: "Ingrese URL objetivo (ej. http://localhost:3000 o https://myapp.es)",
      crawlButton: "Inspeccionar y Rastrear",
      crawling: "Rastreando App...",
      generateTests: "Generar Pruebas de Elementos",
      executeSuite: "Ejecutar Suite en Objetivo",
      buttons: "Botones",
      inputs: "Campos",
      links: "Enlaces",
      headings: "Encabezados",
      wcagScore: "WCAG AA"
    },
    auth: {
      login: "Iniciar Sesión",
      register: "Registrarse",
      logout: "Cerrar Sesión",
      role: "Rol",
      workspace: "Espacio de Trabajo"
    }
  }
};
