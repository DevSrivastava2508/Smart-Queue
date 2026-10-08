const { handleSendConfirmationRequest } = require("../server.js");

module.exports = async (req, res) => {
  return handleSendConfirmationRequest(req, res);
};
