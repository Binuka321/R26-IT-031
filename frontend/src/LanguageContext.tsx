import React from "react";

type Language = "en" | "si";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (en: string, si: string) => string;
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>(() => {
    const stored = localStorage.getItem("floodguard-language");
    return stored === "si" ? "si" : "en";
  });

  const setLanguage = (value: Language) => {
    localStorage.setItem("floodguard-language", value);
    setLanguageState(value);
  };

  const t = (en: string, si: string) => (language === "si" ? si : en);

  React.useEffect(() => {
    document.title = language === "si" ? "ගංවතුර කළමනාකරණය" : "Flood Manager";
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
