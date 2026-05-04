const Portfolio = require('../models/Portfolio');
const Session = require('../models/Session');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Watchlist = require('../models/Watchlist');

const deleteUserAndAssociations = async (userId) => {
  await Promise.all([
    Transaction.deleteMany({ user: userId }),
    Portfolio.deleteOne({ user: userId }),
    Watchlist.deleteOne({ user: userId }),
    Session.deleteMany({ user: userId }),
    User.deleteOne({ _id: userId }),
  ]);
};

module.exports = {
  deleteUserAndAssociations,
};
