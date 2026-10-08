const { handleNextToken } = require("../../server.js");

module.exports = async (req, res) => {
  return handleNextToken(req, res);
};
