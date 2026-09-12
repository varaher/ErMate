const express = require('express');
const app = express();
const server = app.listen(3001, () => {
   console.log(server);
   console.log(typeof server.setTimeout);
   server.close();
});
