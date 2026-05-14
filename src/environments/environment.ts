export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8000/api',
  googleClientId: '892122916055-240981kfd9e87q5uoblt2gi8bg2mf8le.apps.googleusercontent.com',
  /**
   * When true, hydrate the app from /data/pilot-testers.json instead of hitting
   * the Laravel backend. Flip to false once the backend is wired up — services
   * fall back to their normal HTTP paths.
   */
  useStaticData: true,
};
