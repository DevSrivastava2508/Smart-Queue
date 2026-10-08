const { handleHealthRequest } = require("../server.js");

module.exports = async (req, res) => {
  return handleHealthRequest(req, res);
};
