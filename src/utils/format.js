// src/utils/format.js
function formatCurrency(n) {
  return Intl.NumberFormat("vi-VN").format(n);
}

module.exports = { formatCurrency, fmt: formatCurrency };
