//
// Copyright (c) Squid. Todos os direitos reservados.
//

// Registro de dependências.
const _ = require('lodash');

// Métodos de util

/**
 * Realiza a validação e ajuste dos parâmetros opcionais.
 */
exports.normalizeArgs = function (optionsOrCallback, callback, result) {
  let finalCallback = callback;
  let options = {};

  if (_.isFunction(optionsOrCallback) && !callback) {
    finalCallback = optionsOrCallback;
  } else if (optionsOrCallback) {
    options = optionsOrCallback;
  }

  result(options, finalCallback);
};
