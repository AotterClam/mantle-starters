export type SiteAction = {
  readonly label: string;
  readonly href: string;
  readonly icon?: "cart";
};

export type SiteContent = {
  readonly brand: string;
  readonly description: string;
  readonly navLinks: readonly SiteAction[];
  readonly navAction?: SiteAction;
  readonly chromeLabels: {
    readonly openNavigation: string;
    readonly closeNavigation: string;
    readonly navigation: string;
    readonly toggleTheme: string;
    readonly lightMode: string;
    readonly darkMode: string;
    readonly language?: string;
  };
  readonly footer: {
    readonly tagline?: string;
    readonly copyright?: string;
    readonly columns: readonly {
      readonly title: string;
      readonly links: readonly SiteAction[];
    }[];
    readonly socialLinks: readonly {
      readonly name: string;
      readonly href: string;
      readonly icon: "github" | "linkedin" | "instagram" | "facebook" | "youtube" | "x";
    }[];
    readonly bottomLinks: readonly SiteAction[];
  };
};

export type HomeItem = {
  readonly title?: string;
  readonly body?: string;
  readonly href?: string;
  readonly icon?: string;
};

export type HomeSection = {
  readonly type: "hero" | "content" | "features" | "faq" | "cta";
  readonly id?: string;
  readonly eyebrow?: string;
  readonly title: string;
  readonly body?: string;
  readonly showImage?: boolean;
  readonly image?: {
    readonly src: string;
    readonly alt: string;
  };
  readonly action?: SiteAction;
  readonly secondaryAction?: SiteAction;
  readonly footerAction?: SiteAction;
  readonly items?: readonly HomeItem[];
};

export type HomeContent = {
  readonly sections: readonly HomeSection[];
};
