const { handlePatientArrived } = require("../../server.js");

module.exports = async (req, res) => {
  return handlePatientArrived(req, res);
};
