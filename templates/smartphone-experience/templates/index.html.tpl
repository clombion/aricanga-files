<!DOCTYPE html>
<html lang="{{locale}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>{{title}}</title>
  <!-- Generated theme variables (from TOML) -->
  <link rel="stylesheet" href="./css/generated/theme-vars.css">
  <!-- Base theme (typography, spacing, resets) -->
  <link rel="stylesheet" href="./css/theme.css">
</head>
<body>
  <div id="app">
    <phone-status-bar></phone-status-bar>
    <chat-hub></chat-hub>
    <chat-thread hidden></chat-thread>
    <settings-page hidden></settings-page>
    <notification-popup></notification-popup>
    <notification-drawer></notification-drawer>
    <connection-overlay hidden></connection-overlay>
    <home-indicator></home-indicator>
  </div>
  <debug-panel></debug-panel>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
