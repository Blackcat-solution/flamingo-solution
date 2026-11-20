import { unprocessable } from './errors.js';

export function parse(schema, data, message = 'Please correct the highlighted fields.') {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw unprocessable(
      message,
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    );
  }
  return result.data;
}
