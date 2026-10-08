const { handleAddPatient } = require("../../server.js");

module.exports = async (req, res) => {
  return handleAddPatient(req, res);
};
