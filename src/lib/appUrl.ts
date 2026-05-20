export const PUBLIC_APP_URL = "https://athrios-tarefas.lovable.app";

export const buildAppUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${PUBLIC_APP_URL}${normalized}`;
};
