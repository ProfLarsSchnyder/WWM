// Stabiler Startpunkt: zuerst die bewährte App laden, danach die neue Zugriffsschicht.
// Falls die Zugriffsschicht ausfällt, bleibt die Haupt-App trotzdem vollständig bedienbar.
await import('./app-core-v3.js?v=20261002-trash2');
try {
  await import('./access-ui-v4.js?v=20261002-trash1');
} catch (error) {
  console.error('WWM Zugriffssystem konnte nicht geladen werden. Die Haupt-App bleibt aktiv.', error);
}
