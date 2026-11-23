import { describe, expect, it } from 'vitest';
import { commandFailure } from './command-result';

describe('database conflict contract', () => {
  it.each(['PT409', '40001', '40P01', '23505'])('keeps %s a conflict without exposing database details', code => {
    expect(commandFailure({code}, 'test-correlation')).toEqual({status:'error',code:'CONFLICT',correlationId:'test-correlation'});
  });
  it('keeps authorization and availability failures distinct', () => {
    expect(commandFailure({code:'42501'}, 'test').code).toBe('FORBIDDEN');
    expect(commandFailure({code:'08006'}, 'test').code).toBe('UNAVAILABLE');
  });
});
