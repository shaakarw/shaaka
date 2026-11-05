const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getClient } = require('../config/db');

const POPULATE_MODELS = {
  user: 'User', userId: 'User', owner: 'User', ownerId: 'User', savedPosts: 'Post',
  senderId: 'User', receiverId: 'User', reporter: 'User', createdBy: 'User',
  updatedBy: 'User', post: 'Post', postId: 'Post', messageId: 'Message',
  mallId: 'Place', placeId: 'Place', shopId: 'Place', shoppingMallId: 'Place',
  mallShopId: 'MallShop', deviceTokenId: 'DeviceToken',
};

const idString = (value) => {
  if (value && typeof value === 'object' && value._id !== undefined) return String(value._id);
  return value == null ? value : String(value);
};

const makeId = () => crypto.randomBytes(12).toString('hex');
const clone = (value) => {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value);
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
};
const mergeDefaults = (defaults, value) => {
  const result = clone(defaults) || {};
  for (const [key, entry] of Object.entries(value || {})) {
    result[key] = entry && typeof entry === 'object' && !Array.isArray(entry) && !(entry instanceof Date)
      ? mergeDefaults(result[key] || {}, entry)
      : clone(entry);
  }
  return result;
};

const pathValues = (value, path) => {
  const [head, ...tail] = path.split('.');
  if (Array.isArray(value)) return value.flatMap((entry) => pathValues(entry, path));
  if (value == null || !Object.prototype.hasOwnProperty.call(value, head)) return [undefined];
  if (!tail.length) return [value[head]];
  return pathValues(value[head], tail.join('.'));
};

const comparable = (value) => value instanceof Date ? value.getTime() : value;
const compareValues = (left, right) => {
  const isIsoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value);
  const leftIsDate = left instanceof Date || isIsoDate(left);
  const rightIsDate = right instanceof Date || isIsoDate(right);
  if ((leftIsDate && rightIsDate) || (leftIsDate && typeof right === 'number') || (rightIsDate && typeof left === 'number')) {
    const asTimestamp = (value) => value instanceof Date ? value.getTime()
      : typeof value === 'number' ? value : Date.parse(value);
    return asTimestamp(left) < asTimestamp(right) ? -1 : asTimestamp(left) > asTimestamp(right) ? 1 : 0;
  }
  return comparable(left) < comparable(right) ? -1 : comparable(left) > comparable(right) ? 1 : 0;
};
const equal = (left, right) => {
  if (left === undefined || right === undefined) return left === right;
  if (left instanceof Date || right instanceof Date) {
    return new Date(left).getTime() === new Date(right).getTime();
  }
  if (Array.isArray(left)) return left.some((entry) => equal(entry, right));
  if (left && typeof left === 'object') return JSON.stringify(left) === JSON.stringify(right);
  return String(left) === String(right);
};

const matchesOperator = (actualValues, operator, expected) => {
  const present = actualValues.some((value) => value !== undefined);
  const some = (predicate) => actualValues.some((value) => predicate(value));
  switch (operator) {
    case '$exists': return present === Boolean(expected);
    case '$eq': return some((value) => equal(value, expected));
    case '$ne': return !some((value) => equal(value, expected));
    case '$in': return some((value) => expected.some((item) => equal(value, item)));
    case '$nin': return !some((value) => expected.some((item) => equal(value, item)));
    case '$gt': return some((value) => compareValues(value, expected) > 0);
    case '$gte': return some((value) => compareValues(value, expected) >= 0);
    case '$lt': return some((value) => compareValues(value, expected) < 0);
    case '$lte': return some((value) => compareValues(value, expected) <= 0);
    case '$size': return some((value) => Array.isArray(value) && value.length === expected);
    case '$all': return some((value) => Array.isArray(value) && expected.every((item) => value.some((entry) => equal(entry, item))));
    case '$elemMatch': return some((value) => Array.isArray(value) && value.some((entry) => matches(entry, expected)));
    case '$type': return some((value) => {
      if (expected === 'date') return value instanceof Date || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
      if (expected === 'string') return typeof value === 'string';
      if (expected === 'number') return typeof value === 'number';
      if (expected === 'bool' || expected === 'boolean') return typeof value === 'boolean';
      if (expected === 'array') return Array.isArray(value);
      if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
      return false;
    });
    case '$regex': {
      const regex = expected instanceof RegExp ? expected : new RegExp(expected, 'i');
      return some((value) => value != null && regex.test(String(value)));
    }
    default: return false;
  }
};

const matchesField = (document, field, expected) => {
  const actualValues = pathValues(document, field);
  if (expected instanceof RegExp) return matchesOperator(actualValues, '$regex', expected);
  if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof Date)) {
    if (Array.isArray(expected.$or)) {
      return expected.$or.some((condition) => Object.entries(condition).every(([operator, value]) => (
        matchesOperator(actualValues, operator, value)
      )));
    }
    const operators = Object.keys(expected);
    if (operators.some((key) => key.startsWith('$'))) {
      return operators.every((operator) => {
        if (operator === '$options') return true;
        if (operator === '$regex' && expected.$options) {
          const regex = new RegExp(expected.$regex, expected.$options);
          return actualValues.some((value) => value != null && regex.test(String(value)));
        }
        return matchesOperator(actualValues, operator, expected[operator]);
      });
    }
    return actualValues.some((value) => equal(value, expected));
  }
  return actualValues.some((value) => equal(value, expected));
};

const matches = (document, filter = {}) => Object.entries(filter).every(([field, expected]) => {
  if (field === '$or') return expected.some((entry) => matches(document, entry));
  if (field === '$and') return expected.every((entry) => matches(document, entry));
  if (field === '$nor') return !expected.some((entry) => matches(document, entry));
  return matchesField(document, field === '_id' ? '_id' : field, expected);
});

const ARRAY_PATH_SEGMENTS = new Set([
  'avatarVariants', 'stories', 'views', 'paymentHistory', 'savedPosts', 'contactNumbers',
  'houseImages', 'houseImageStorageKeys', 'houseImageVariants', 'products', 'imageVariants',
  'imageUrls', 'imageStorageKeys', 'deletedFor', 'deliveryAttempts', 'steps',
  'requiredSkills', 'equipment', 'potentialCustomers', 'challenges',
]);

const jsonPathFor = (field) => `$.${field.split('.').map((part) => `"${part.replace(/"/g, '\\"')}"`).join('.')}`;
const filterValue = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value && typeof value === 'object' && value._id !== undefined) return String(value._id);
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value === undefined ? null : value;
};

const quoteIdentifier = (identifier) => `"${identifier.replace(/"/g, '""')}"`;

const compileFilter = (filter = {}, table, columnMap = {}) => {
  const clauses = [];
  const args = [];
  const tableRef = quoteIdentifier(table);
  const payloadRef = `${tableRef}.${quoteIdentifier('payload')}`;

  for (const [field, expected] of Object.entries(filter)) {
    if (field === '$or' || field === '$and' || field === '$nor') {
      if (!Array.isArray(expected)) return null;
      const children = expected.map((condition) => compileFilter(condition, table, columnMap));
      if (children.some((child) => child === null)) return null;
      const joiner = field === '$and' ? ' AND ' : ' OR ';
      let clause = children.length
        ? `(${children.map((child) => child.sql).join(joiner)})`
        : (field === '$and' ? '1' : '0');
      if (field === '$nor') clause = `NOT ${clause}`;
      clauses.push(clause);
      for (const child of children) args.push(...child.args);
      continue;
    }

    if (field.startsWith('$')) return null;
    if (expected && typeof expected === 'object' && Array.isArray(expected.$or)) {
      const branches = expected.$or.map((condition) => compileFilter({ [field]: condition }, table, columnMap));
      clauses.push(`(${branches.map((branch) => branch.sql).join(' OR ')})`);
      for (const branch of branches) args.push(...branch.args);
      continue;
    }

    const path = jsonPathFor(field);
    const columnName = field === '_id' ? 'id' : columnMap[field];
    const arrayIndex = field.split('.').findIndex((part) => ARRAY_PATH_SEGMENTS.has(part));
    const arrayPath = arrayIndex < 0 ? null : field.split('.').slice(0, arrayIndex + 1).join('.');
    const arraySubPath = arrayIndex < 0 ? null : field.split('.').slice(arrayIndex + 1).join('.');
    const arrayExpression = arrayPath
      ? (arraySubPath ? `json_extract(_array.value, ?)` : '_array.value')
      : null;
    const expression = columnName
      ? `${tableRef}.${quoteIdentifier(columnName)}`
      : arrayExpression || `json_extract(${payloadRef}, ?)`;
    const expressionArgs = columnName ? [] : arrayPath
      ? (arraySubPath ? [jsonPathFor(arraySubPath)] : [])
      : [path];

    const appendPredicate = (predicate, predicateArgs, { missingIsMatch = false } = {}) => {
      if (arrayPath) {
        const arrayRootPath = jsonPathFor(arrayPath);
        const exists = `EXISTS (SELECT 1 FROM json_each(${payloadRef}, ?) AS _array WHERE ${predicate})`;
        clauses.push(missingIsMatch ? `(${exists} OR NOT EXISTS (SELECT 1 FROM json_each(${payloadRef}, ?)))` : exists);
        args.push(arrayRootPath, ...predicateArgs);
        if (missingIsMatch) args.push(arrayRootPath);
      } else {
        clauses.push(predicate);
        args.push(...predicateArgs);
      }
    };

    if (expected && typeof expected === 'object' && !(expected instanceof Date) && !(expected instanceof RegExp)) {
      for (const [operator, value] of Object.entries(expected)) {
        if (operator === '$options') continue;
        if (operator === '$exists') {
          if (arrayPath) {
            const existsPath = arraySubPath ? `json_type(_array.value, ?) IS NOT NULL` : '1';
            const existsArgs = arraySubPath ? [jsonPathFor(arraySubPath)] : [];
            const exists = `EXISTS (SELECT 1 FROM json_each(${payloadRef}, ?) AS _array WHERE ${existsPath})`;
            clauses.push(value ? exists : `NOT ${exists}`);
            args.push(jsonPathFor(arrayPath), ...existsArgs);
          } else if (columnName) {
            clauses.push(`${expression} IS ${value ? 'NOT ' : ''}NULL`);
          } else {
            clauses.push(`json_type(${payloadRef}, ?) IS ${value ? 'NOT ' : ''}NULL`);
            args.push(path);
          }
        } else if (operator === '$eq' || operator === '$ne') {
          const sqlOperator = operator === '$eq' ? 'IS' : 'IS NOT';
          appendPredicate(`${expression} ${sqlOperator} ?`, [...expressionArgs, filterValue(value)], {
            missingIsMatch: operator === '$ne' && !columnName,
          });
        } else if (operator === '$in' || operator === '$nin') {
          if (!Array.isArray(value)) return null;
          if (!value.length) {
            clauses.push(operator === '$in' ? '0' : '1');
            continue;
          }
          appendPredicate(`${expression} ${operator === '$in' ? 'IN' : 'NOT IN'} (${value.map(() => '?').join(', ')})`, [
            ...expressionArgs, ...value.map(filterValue),
          ], { missingIsMatch: operator === '$nin' && !columnName });
        } else if (['$gt', '$gte', '$lt', '$lte'].includes(operator)) {
          let normalizedValue = filterValue(value);
          if (typeof value === 'number' && /(At|Date|Expire|Expiry)$/i.test(field)) {
            normalizedValue = new Date(value).toISOString();
          }
          const sqlOperator = { $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' }[operator];
          appendPredicate(`${expression} ${sqlOperator} ?`, [...expressionArgs, normalizedValue]);
        } else if (operator === '$type') {
          const typeExpressions = {
            string: `json_type(${payloadRef}, ?) = 'text'`,
            number: `json_type(${payloadRef}, ?) IN ('integer', 'real')`,
            bool: `json_type(${payloadRef}, ?) IN ('true', 'false')`,
            boolean: `json_type(${payloadRef}, ?) IN ('true', 'false')`,
            array: `json_type(${payloadRef}, ?) = 'array'`,
            object: `json_type(${payloadRef}, ?) = 'object'`,
            date: `json_type(${payloadRef}, ?) = 'text' AND substr(json_extract(${payloadRef}, ?), 5, 1) = '-' AND substr(json_extract(${payloadRef}, ?), 8, 1) = '-'`,
          };
          const expression = typeExpressions[value];
          if (!expression) return null;
          clauses.push(`(${expression})`);
          args.push(path);
          if (value === 'date') args.push(path, path);
        } else if (operator === '$regex') {
          const anchoredStart = String(value).startsWith('^');
          const anchoredEnd = String(value).endsWith('$');
          let pattern = String(value).replace(/^\^/, '').replace(/\$$/, '');
          pattern = pattern.replace(/\\(.)/g, '$1').replace(/[\\%_]/g, '\\$&');
          pattern = pattern.replace(/\.\*/g, '\u0000').replace(/\./g, '_').replace(/\u0000/g, '%');
          if (!anchoredStart) pattern = `%${pattern}`;
          if (!anchoredEnd) pattern = `${pattern}%`;
          appendPredicate(`LOWER(CAST(${expression} AS TEXT)) LIKE LOWER(?) ESCAPE '\\'`, [
            ...expressionArgs, pattern,
          ]);
        } else if (operator === '$size') {
          appendPredicate(`json_array_length(${payloadRef}, ?) = ?`, [path, value]);
        } else if (operator === '$all') {
          if (!Array.isArray(value)) return null;
          for (const item of value) {
            clauses.push(`EXISTS (SELECT 1 FROM json_each(${payloadRef}, ?) AS _all_items WHERE _all_items.value IS ?)`);
            args.push(path, filterValue(item));
          }
        } else if (operator === '$elemMatch') {
          if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
          const nestedConditions = Object.entries(value).map(([nestedField, nestedValue]) => {
            const nestedColumn = `json_extract(_elem.value, ?)`;
            const nestedPath = jsonPathFor(nestedField);
            if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
              const operators = Object.entries(nestedValue);
              const nestedClauses = [];
              const nestedArgs = [];
              for (const [nestedOperator, nestedExpected] of operators) {
                const sqlOperator = { $eq: 'IS', $ne: 'IS NOT', $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' }[nestedOperator];
                if (!sqlOperator) return null;
                nestedClauses.push(`${nestedColumn} ${sqlOperator} ?`);
                nestedArgs.push(nestedPath, filterValue(nestedExpected));
              }
              return { sql: nestedClauses.join(' AND '), args: nestedArgs };
            }
            return { sql: `${nestedColumn} IS ?`, args: [nestedPath, filterValue(nestedValue)] };
          });
          if (nestedConditions.some((condition) => condition === null)) return null;
          clauses.push(`EXISTS (SELECT 1 FROM json_each(${payloadRef}, ?) AS _elem WHERE ${nestedConditions.map((condition) => condition.sql).join(' AND ')})`);
          args.push(path);
          for (const condition of nestedConditions) args.push(...condition.args);
        } else {
          return null;
        }
      }
    } else if (expected instanceof RegExp) {
      const pattern = expected.source;
      const like = pattern.replace(/^\^/, '').replace(/\$$/, '').replace(/\.\*/g, '%').replace(/\./g, '_');
      appendPredicate(`LOWER(CAST(${expression} AS TEXT)) LIKE LOWER(?) ESCAPE '\\'`, [
        ...expressionArgs,
        `${String(expected.source).startsWith('^') ? '' : '%'}${like}${String(expected.source).endsWith('$') ? '' : '%'}`,
      ]);
    } else if (Array.isArray(expected)) {
      appendPredicate(`${expression} IS ?`, [...expressionArgs, JSON.stringify(expected)]);
    } else {
      appendPredicate(`${expression} IS ?`, [...expressionArgs, filterValue(expected)]);
    }
  }

  return { sql: clauses.length ? clauses.join(' AND ') : '1', args };
};

const setPath = (object, path, value) => {
  const parts = path.split('.');
  let current = object;
  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== 'object') current[part] = {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
};

const unsetPath = (object, path) => {
  const parts = path.split('.');
  let current = object;
  for (const part of parts.slice(0, -1)) {
    current = current && current[part];
    if (!current) return;
  }
  if (current) delete current[parts[parts.length - 1]];
};

const setUpdatePath = (document, path, value, filter, unset = false) => {
  const parts = path.split('.');
  const positionalIndex = parts.indexOf('$');
  if (positionalIndex < 0) {
    if (unset) unsetPath(document, path);
    else setPath(document, path, clone(value));
    return;
  }
  const arrayPath = parts.slice(0, positionalIndex).join('.');
  const subPath = parts.slice(positionalIndex + 1).join('.');
  const array = pathValues(document, arrayPath)[0];
  if (!Array.isArray(array)) return;
  const elementFilter = {};
  for (const [filterPath, expected] of Object.entries(filter || {})) {
    const prefix = `${arrayPath}.`;
    if (filterPath.startsWith(prefix)) elementFilter[filterPath.slice(prefix.length)] = expected;
  }
  for (const entry of array) {
    if (!matches(entry, elementFilter)) continue;
    if (unset) unsetPath(entry, subPath);
    else setPath(entry, subPath, clone(value));
  }
};

const updateDocument = (document, update, inserting = false, filter = {}) => {
  const keys = Object.keys(update || {});
  const operatorUpdate = keys.some((key) => key.startsWith('$'));
  if (!operatorUpdate) {
    for (const [key, value] of Object.entries(update || {})) setUpdatePath(document, key, value, filter);
    return;
  }
  for (const [operator, values] of Object.entries(update)) {
    if (operator === '$set' || (operator === '$setOnInsert' && inserting)) {
      for (const [key, value] of Object.entries(values)) setUpdatePath(document, key, value, filter);
    } else if (operator === '$unset') {
      for (const key of Object.keys(values)) setUpdatePath(document, key, undefined, filter, true);
    } else if (operator === '$inc') {
      for (const [key, value] of Object.entries(values)) {
        setUpdatePath(document, key, (Number(pathValues(document, key)[0]) || 0) + Number(value), filter);
      }
    } else if (operator === '$push' || operator === '$addToSet') {
      for (const [key, value] of Object.entries(values)) {
        const current = pathValues(document, key)[0];
        const items = value && value.$each ? value.$each : [value];
        const next = Array.isArray(current) ? current.slice() : [];
        for (const item of items) {
          if (operator === '$push' || !next.some((entry) => equal(entry, item))) next.push(clone(item));
        }
        setUpdatePath(document, key, next, filter);
      }
    } else if (operator === '$pull') {
      for (const [key, value] of Object.entries(values)) {
        const current = pathValues(document, key)[0];
        if (Array.isArray(current)) {
          setUpdatePath(document, key, current.filter((entry) => (
            value && typeof value === 'object' && !Array.isArray(value)
              ? !matches(entry, value)
              : !equal(entry, value)
          )), filter);
        }
      }
    }
  }
};

const selectFields = (document, selection) => {
  if (!selection) return document;
  const fields = Array.isArray(selection) ? selection
    : typeof selection === 'object'
      ? Object.entries(selection).filter(([, include]) => include).map(([field]) => field)
        .concat(Object.entries(selection).filter(([, include]) => !include).map(([field]) => `-${field}`))
      : String(selection).split(/\s+/).filter(Boolean);
  const excluded = fields.filter((field) => field.startsWith('-')).map((field) => field.slice(1));
  const included = fields.filter((field) => !field.startsWith('-'));
  if (included.length) {
    const result = {};
    if (!included.includes('_id') && document._id !== undefined) result._id = document._id;
    for (const field of included) {
      const value = pathValues(document, field)[0];
      if (value !== undefined) setPath(result, field, value);
    }
    return result;
  }
  const result = clone(document);
  for (const field of excluded) unsetPath(result, field);
  return result;
};

const applyPopulate = async (document, populateOptions) => {
  const populatedPaths = [];
  for (const option of populateOptions) {
    const path = option.path;
    const values = pathValues(document, path)[0];
    const modelName = option.model || POPULATE_MODELS[path] || POPULATE_MODELS[path.split('.').pop()];
    const model = modelName && models[modelName];
    if (!model || values == null) continue;

    const populateOne = async (value) => {
      const id = idString(value);
      const result = await model.findById(id);
      if (!result) return null;
      const populated = selectFields(result, option.select);
      if (option.populate) {
        const nestedOptions = Array.isArray(option.populate)
          ? option.populate
          : [typeof option.populate === 'string' ? { path: option.populate } : option.populate];
        await applyPopulate(populated, nestedOptions);
      }
      return populated;
    };
    const populated = Array.isArray(values)
      ? await Promise.all(values.map(populateOne))
      : await populateOne(values);
    setPath(document, path, populated);
    populatedPaths.push(path);
  }
  if (populatedPaths.length) {
    Object.defineProperty(document, '__populatedPaths', { value: populatedPaths, configurable: true });
  }
};

const restorePopulatedIds = (document) => {
  const result = clone(document) || {};
  for (const path of document.__populatedPaths || []) {
    const value = pathValues(result, path)[0];
    if (Array.isArray(value)) setPath(result, path, value.map(idString));
    else if (value != null) setPath(result, path, idString(value));
  }
  delete result.id;
  return result;
};

const models = {};

const createModel = (modelName, collection, options = {}) => {
  const table = collection;
  const columns = options.columns || {};
  const defaults = options.defaults || {};
  const sqlValue = (value) => {
    if (value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value && typeof value === 'object') return idString(value);
    return value;
  };
  const applyDefaults = (data = {}) => {
    const defaultValues = typeof defaults === 'function' ? defaults() : defaults;
    const document = mergeDefaults(defaultValues, data);
    if (!document._id) document._id = makeId();
    if (options.timestamps) {
      if (!document.createdAt) document.createdAt = new Date().toISOString();
      if (!document.updatedAt) document.updatedAt = document.createdAt;
    }
    return document;
  };

  const persist = async (data, original) => {
    const document = restorePopulatedIds({ ...(original || {}), ...data });
    delete document.id;
    document._id = idString(document._id);
    if (!document._id) document._id = makeId();
    if (options.beforeSave) await options.beforeSave(document, original);
    if (options.timestamps) document.updatedAt = new Date().toISOString();

    const database = getClient();
    const values = [['id', document._id]];
    for (const [field, column] of Object.entries(columns)) {
      values.push([column, sqlValue(document[field])]);
    }
    for (const [field, reference] of Object.entries(options.foreignReferences || {})) {
      const referencedId = idString(document[field]);
      let linkedId = null;
      if (referencedId) {
        const exists = await database.execute({
          sql: `SELECT id FROM ${quoteIdentifier(reference.target)} WHERE id = ?`,
          args: [referencedId],
        });
        if (exists.rows.length) linkedId = referencedId;
      }
      values.push([reference.column, linkedId]);
    }
    values.push(['payload', JSON.stringify(document)]);
    const columnList = values.map(([column]) => quoteIdentifier(column)).join(', ');
    const placeholders = values.map(() => '?').join(', ');
    const updates = values.slice(1).map(([column]) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`).join(', ');
    try {
      await database.execute({
        sql: `INSERT INTO ${quoteIdentifier(table)} (${columnList}) VALUES (${placeholders})
              ON CONFLICT(id) DO UPDATE SET ${updates}`,
        args: values.map(([, value]) => value),
      });
    } catch (error) {
      if (/UNIQUE constraint|SQLITE_CONSTRAINT/i.test(error.message || '')) error.code = 11000;
      throw error;
    }
    return document;
  };

  const attach = (data, original) => {
    const document = clone(data) || {};
    document.id = idString(document._id);
    Object.defineProperty(document, '__original', {
      value: original === null ? null : clone(original || data),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, 'save', {
      enumerable: false,
      value: async function save() {
        const saved = await persist(this, this.__original);
        for (const key of Object.keys(this)) delete this[key];
        Object.assign(this, saved);
        this.id = idString(saved._id);
        this.__original = clone(saved);
        return this;
      },
    });
    Object.defineProperty(document, 'deleteOne', {
      enumerable: false,
      value: async function deleteOne() {
        await getClient().execute({
          sql: `DELETE FROM ${quoteIdentifier(table)} WHERE id = ?`,
          args: [idString(this._id)],
        });
        return { acknowledged: true, deletedCount: 1 };
      },
    });
    Object.defineProperty(document, 'toObject', {
      enumerable: false,
      value: function toObject() {
        return clone(this);
      },
    });
    Object.defineProperty(document, 'toJSON', {
      enumerable: false,
      value: function toJSON() {
        return clone(this);
      },
    });
    if (modelName === 'User') {
      Object.defineProperty(document, 'matchPassword', {
        enumerable: false,
        value: async function matchPassword(enteredPassword) {
          return bcrypt.compare(enteredPassword, this.password);
        },
      });
      Object.defineProperty(document, 'getPublicProfile', {
        enumerable: false,
        value: function getPublicProfile() {
          const result = clone(this);
          delete result.password;
          delete result.resetPasswordToken;
          delete result.resetPasswordExpire;
          return result;
        },
      });
    }
    return document;
  };

  const hydrate = (row) => {
    const data = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    return attach(data, data);
  };
  const sortExpression = (field) => {
    const column = field === '_id' ? 'id' : columns[field];
    return column
      ? `${quoteIdentifier(table)}.${quoteIdentifier(column)}`
      : `json_extract(${quoteIdentifier(table)}.${quoteIdentifier('payload')}, ?)`;
  };
  const readRows = async (filter = {}, queryOptions = {}) => {
    const database = getClient();
    const compiled = compileFilter(filter, table, columns);
    if (!compiled) throw new Error(`Unsupported SQL filter for ${modelName}`);
    const sortArgs = [];
    const orderBy = queryOptions.sort
      ? Object.entries(queryOptions.sort).map(([field, direction]) => {
        const column = field === '_id' ? 'id' : columns[field];
        if (!column) sortArgs.push(jsonPathFor(field));
        return `${sortExpression(field)} ${Number(direction) < 0 ? 'DESC' : 'ASC'}`;
      }).join(', ')
      : '';
    const where = compiled.sql ? ` WHERE ${compiled.sql}` : '';
    const order = orderBy ? ` ORDER BY ${orderBy}` : '';
    const limit = queryOptions.limit != null || queryOptions.skip ? ' LIMIT ?' : '';
    const offset = queryOptions.skip ? ' OFFSET ?' : '';
    const queryArgs = [...compiled.args, ...sortArgs];
    if (queryOptions.limit != null || queryOptions.skip) queryArgs.push(queryOptions.limit == null ? -1 : queryOptions.limit);
    if (queryOptions.skip) {
      queryArgs.push(queryOptions.skip);
    }
    const result = await database.execute({
      sql: `SELECT ${quoteIdentifier(table)}.payload FROM ${quoteIdentifier(table)}${where}${order}${limit}${offset}`,
      args: queryArgs,
    });
    return result.rows.map(hydrate);
  };

  class Query {
    constructor(operation, filter, update, queryOptions = {}) {
      this.operation = operation;
      this.filter = filter || {};
      this.update = update;
      this.options = queryOptions;
      this.selection = queryOptions && queryOptions.select ? queryOptions.select : null;
      this.sortOrder = null;
      this.populateOptions = [];
      this.rowLimit = null;
      this.rowSkip = 0;
      this.promise = null;
    }
    select(selection) { this.selection = selection; return this; }
    sort(sortOrder) { this.sortOrder = sortOrder; return this; }
    populate(path, selection) {
      if (Array.isArray(path)) {
        for (const item of path) this.populate(item.path || item, item.select);
      } else if (path && typeof path === 'object') {
        this.populateOptions.push({
          path: path.path,
          select: path.select,
          model: path.model,
          populate: path.populate,
        });
      } else {
        this.populateOptions.push({ path, select: selection });
      }
      return this;
    }
    lean() { this.options.lean = true; return this; }
    limit(count) { this.rowLimit = Number(count); return this; }
    skip(count) { this.rowSkip = Number(count); return this; }
    exec() {
      if (!this.promise) this.promise = this.run();
      return this.promise;
    }
    then(resolve, reject) { return this.exec().then(resolve, reject); }
    catch(reject) { return this.exec().catch(reject); }
    finally(callback) { return this.exec().finally(callback); }
    async formatDocument(data, original) {
      if (!data) return null;
      const selected = selectFields(data, this.selection);
      if (this.populateOptions.length) await applyPopulate(selected, this.populateOptions);
      if (this.options.lean) {
        delete selected.id;
        return selected;
      }
      return attach(selected, original || data);
    }
    async run() {
      const database = getClient();
      if (this.operation === 'count') {
        const compiled = compileFilter(this.filter, table, columns);
        if (!compiled) throw new Error(`Unsupported SQL filter for ${modelName}`);
        const result = await database.execute({
          sql: `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)} WHERE ${compiled.sql}`,
          args: compiled.args,
        });
        return Number(result.rows[0].count);
      }
      if (this.operation === 'estimatedCount') {
        const result = await database.execute({
          sql: `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`,
        });
        return Number(result.rows[0].count);
      }
      if (this.operation === 'update' || this.operation === 'updateMany') {
        const matchesRows = await readRows(this.filter, {
          sort: this.sortOrder,
          limit: this.operation === 'update' ? 1 : null,
        });
        const selected = this.operation === 'update' ? matchesRows.slice(0, 1) : matchesRows;
        for (const document of selected) {
          const updated = clone(document);
          updateDocument(updated, this.update, false, this.filter);
          await persist(updated, document.__original);
        }
        if (!selected.length && this.options.upsert) {
          const inserted = applyDefaults({});
          for (const [key, value] of Object.entries(this.filter)) {
            if (!key.startsWith('$') && (!value || typeof value !== 'object' || value instanceof Date)) setPath(inserted, key, value);
          }
          updateDocument(inserted, this.update, true, this.filter);
          const saved = await persist(inserted);
          return this.options.new === false ? null : this.formatDocument(saved, saved);
        }
        if (this.options.returnDocument || this.options.new) {
          return selected.length ? this.formatDocument(await readRows({ _id: selected[0]._id }).then((rows) => rows[0]), selected[0]) : null;
        }
        return { acknowledged: true, matchedCount: selected.length, modifiedCount: selected.length, upsertedCount: 0 };
      }
      if (this.operation === 'deleteMany' || this.operation === 'deleteOne') {
        const compiled = compileFilter(this.filter, table, columns);
        if (!compiled) throw new Error(`Unsupported SQL filter for ${modelName}`);
        const sql = this.operation === 'deleteOne'
          ? `DELETE FROM ${quoteIdentifier(table)} WHERE id IN (SELECT id FROM ${quoteIdentifier(table)} WHERE ${compiled.sql} LIMIT 1)`
          : `DELETE FROM ${quoteIdentifier(table)} WHERE ${compiled.sql}`;
        const result = await database.execute({ sql, args: compiled.args });
        return { acknowledged: true, deletedCount: Number(result.rowsAffected || 0) };
      }

      let found = await readRows(this.filter, {
        sort: this.sortOrder,
        limit: this.operation === 'findOne' || this.operation === 'findById' || this.operation === 'findOneAndDelete' || this.operation === 'findOneAndUpdate'
          ? 1 : this.rowLimit,
        skip: this.rowSkip,
      });
      if (this.operation === 'findOneAndDelete') {
        const document = found[0];
        if (document) await document.deleteOne();
        return document;
      }
      if (this.operation === 'findOneAndUpdate') {
        const document = found[0];
        if (!document) {
          if (!this.options.upsert) return null;
          const inserted = applyDefaults({});
          updateDocument(inserted, this.update, true, this.filter);
          const saved = await persist(inserted);
          return this.formatDocument(saved, saved);
        }
        const before = clone(document);
        const updated = clone(document);
        updateDocument(updated, this.update, false, this.filter);
        const saved = await persist(updated, document.__original);
        const returnAfter = this.options.new || this.options.returnDocument === 'after';
        return this.formatDocument(returnAfter ? saved : before, document.__original);
      }
      if (this.operation === 'findById') found = found.slice(0, 1);
      const output = [];
      for (const document of found) {
        if (this.populateOptions.length) await applyPopulate(document, this.populateOptions);
        const selected = selectFields(document, this.selection);
        if (this.options.lean) delete selected.id;
        output.push(this.options.lean ? selected : attach(selected, document.__original));
      }
      if (this.operation === 'findOne' || this.operation === 'findById') return output[0] || null;
      return output;
    }
  }

  const Model = function Model(data = {}) {
    return attach(applyDefaults(data), null);
  };
  Object.defineProperty(Model, 'modelName', { value: modelName });
  Model.schema = {
    path: (field) => options.fieldTypes && options.fieldTypes[field]
      ? { instance: options.fieldTypes[field] }
      : undefined,
  };
  Model.find = (filter = {}, projection) => new Query('find', filter).select(projection);
  Model.findOne = (filter = {}, projection) => new Query('findOne', filter).select(projection);
  Model.findById = (id) => new Query('findById', { _id: idString(id) });
  Model.countDocuments = (filter = {}) => new Query('count', filter);
  Model.estimatedDocumentCount = () => new Query('estimatedCount');
  Model.findByIdAndUpdate = (id, update, queryOptions) => new Query('findOneAndUpdate', { _id: idString(id) }, update, queryOptions);
  Model.findOneAndUpdate = (filter, update, queryOptions) => new Query('findOneAndUpdate', filter, update, queryOptions);
  Model.updateOne = (filter, update, queryOptions) => new Query('update', filter, update, queryOptions);
  Model.updateMany = (filter, update, queryOptions) => new Query('updateMany', filter, update, queryOptions);
  Model.findByIdAndDelete = (id) => new Query('findOneAndDelete', { _id: idString(id) });
  Model.findOneAndDelete = (filter) => new Query('findOneAndDelete', filter);
  Model.deleteMany = (filter = {}) => new Query('deleteMany', filter);
  Model.create = async (data) => {
    if (Array.isArray(data)) return Promise.all(data.map((item) => Model.create(item)));
    const document = new Model(data);
    await document.save();
    return document;
  };
  Model.insertMany = Model.create;
  Model.aggregate = async (pipeline = []) => {
    const initialFilter = pipeline[0] && pipeline[0].$match ? pipeline[0].$match : {};
    let result = (await readRows(initialFilter)).map((document) => clone(document));
    for (const stage of pipeline) {
      if (stage.$match) result = result.filter((document) => matches(document, stage.$match));
      if (stage.$group) {
        const group = stage.$group;
        const buckets = new Map();
        for (const document of result) {
          let key = group._id;
          if (key && typeof key === 'object' && key.$dateToString) {
            const rawDate = pathValues(document, group._id.$dateToString.date.slice(1))[0];
            key = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : null;
          } else if (typeof key === 'string' && key.startsWith('$')) {
            key = pathValues(document, key.slice(1))[0];
          }
          const bucketKey = JSON.stringify(key);
          if (!buckets.has(bucketKey)) buckets.set(bucketKey, { _id: key });
          const bucket = buckets.get(bucketKey);
          for (const [name, expression] of Object.entries(group)) {
            if (name === '_id') continue;
            if (expression && expression.$sum !== undefined) {
              const sum = expression.$sum;
              if (typeof sum === 'number') bucket[name] = (bucket[name] || 0) + sum;
              else if (typeof sum === 'string' && sum.startsWith('$')) bucket[name] = (bucket[name] || 0) + (Number(pathValues(document, sum.slice(1))[0]) || 0);
              else if (sum && sum.$size) bucket[name] = (bucket[name] || 0) + (pathValues(document, sum.$size.slice(1))[0] || []).length;
            }
          }
        }
        result = Array.from(buckets.values());
      }
    }
    return result;
  };

  Model._persist = persist;
  Model._compileFilter = (filter) => compileFilter(filter, table, columns);
  models[modelName] = Model;
  return Model;
};

module.exports = createModel;
