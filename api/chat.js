const { handleChatRequest } = require("../server.js");

module.exports = async (req, res) => {
  return handleChatRequest(req, res);
};
