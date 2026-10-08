const { handleSendSmsRequest } = require("../server.js");

module.exports = async (req, res) => {
  return handleSendSmsRequest(req, res);
};
