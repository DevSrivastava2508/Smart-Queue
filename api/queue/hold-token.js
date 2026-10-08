const { handleHoldToken } = require("../../server.js");

module.exports = async (req, res) => {
  return handleHoldToken(req, res);
};
