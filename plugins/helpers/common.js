'use strict';

const { Status } = require('../../db/models');
const { CONSTANTS_KEYS, INIT_CHANNEL, SECRETS_KEYS } = require('../../constants');
const { publisher } = require('../../db/pubsub');
const { omit, each } = require('lodash');
const SECRET_MASK = '************************';

// Winston logger
const logger = require('../../config/logger').loggerPlugin;

const joinConstants = (statusConstants = {}, newConstants = {}) => {
	const joinedConstants = {
		secrets: {}
	};
	CONSTANTS_KEYS.forEach((key) => {
		if (key === 'secrets' && newConstants[key]) {
			SECRETS_KEYS.forEach((secretKey) => {
				joinedConstants[key][secretKey] = newConstants[key][secretKey] || statusConstants[key][secretKey];
			});
		}
		else {
			joinedConstants[key] = newConstants[key] === undefined ? statusConstants[key] : newConstants[key];
		}
	});
	return joinedConstants;
};

const updateConstants = (constants) => {
	return Status.findOne({
		attributes: ['id', 'constants']
	})
		.then((status) => {
			if (Object.keys(constants).length > 0) {
				constants = joinConstants(status.dataValues.constants, constants);
			}
			return status.update({ constants }, {
				fields: [
					'constants'
				],
				returning: true
			});
		})
		.then((data) => {
			const secrets = data.constants.secrets;
			data.constants = omit(data.constants, 'secrets');
			publisher.publish(
				INIT_CHANNEL,
				JSON.stringify({
					type: 'constants', data: { constants: data.constants, secrets }
				})
			);
			return { ...data.constants, secrets };
		});
};

const isUrl = (url) => {
	const pattern = /^(^|\s)((https?:\/\/)?[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)$/;
	return pattern.test(url);
};

const sleep = (ms) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

const getPagination = (limit = 50, page = 1) => {
	let _limit = 50;
	let _page = 1;
	logger.debug('helpers/common/getPagination', _limit, _page);
	if (limit) {
		if (limit > 50) {
			_limit = 50;
		} else if (limit <= 0) {
			_limit = 1;
		} else {
			_limit = limit;
		}
	}

	if (page && page >= 0) {
		_page = page;
	}
	logger.debug('helpers/common/getPagination', _limit, _page);
	return {
		limit: _limit,
		offset: _limit * (_page - 1)
	};
};

const convertSequelizeCountAndRows = (data) => {
	return {
		count: data.count,
		data: data.rows.map((row) => {
			const item = Object.assign({}, row.dataValues);
			// delete item.id;
			return item;
		})
	};
};

const getTimeframe = (start_date = undefined, end_date = undefined) => {
	logger.debug(
		'helpers/common/getTimeframe',
		'stat_date: ',
		start_date,
		'end_date: ',
		end_date
	);
	let timestamp = {};
	if (start_date) timestamp['$gte'] = start_date;
	if (end_date) timestamp['$lte'] = end_date;
	if (Object.entries(timestamp).length === 0) return undefined;
	return timestamp;
};

const getOrdering = (order_by = undefined, order = undefined) => {
	logger.debug(
		'helpers/common/getOrdering',
		'order_by: ',
		order_by,
		'order: ',
		order
	);
	if (!order_by) {
		return undefined;
	} else {
		return [order_by, order || 'desc'];
	}
};

const updatePluginConstant = (plugin, newValues) => {
	return Status.findOne({
		attributes: ['id', 'constants']
	})
		.then((status) => {
			const constants = status.dataValues.constants;
			if (plugin === 'vault') {
				constants.secrets.vault = { ...constants.secrets.vault, ...newValues };
				return status.update({ constants }, {
					fields: [
						'constants'
					],
					returning: true
				});
			} else {
				constants.secrets.plugins[plugin] = { ...constants.secrets.plugins[plugin], ...newValues };
				return status.update({ constants }, {
					fields: [
						'constants'
					],
					returning: true
				});
			}
		})
		.then((data) => {
			const secrets = data.constants.secrets;
			data.constants = omit(data.constants, 'secrets');
			publisher.publish(
				INIT_CHANNEL,
				JSON.stringify({
					type: 'constants', data: { constants: data.constants, secrets }
				})
			);
			return maskSecrets(plugin, plugin === 'vault' ? secrets.vault : secrets.plugins[plugin]);
		});
};

const maskSecrets = (plugin, secrets) => {
	each(secrets, (secret, secretKey) => {
		if (plugin === 's3' && secretKey === 'secret') {
			secrets[secretKey] = {
				write: SECRET_MASK,
				read: SECRET_MASK
			};
		} else if ((plugin === 'zendesk' || plugin === 'freshdesk') && secretKey === 'key') {
			secrets[secretKey] = SECRET_MASK;
		} else if (secretKey === 'secret' || secretKey === 'auth') {
			secrets[secretKey] = SECRET_MASK;
		}
	});
	return secrets;
};

module.exports = {
	logger,
	updateConstants,
	isUrl,
	sleep,
	getPagination,
	getOrdering,
	getTimeframe,
	convertSequelizeCountAndRows,
	updatePluginConstant,
	maskSecrets
};