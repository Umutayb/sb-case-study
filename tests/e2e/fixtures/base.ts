import { test as base, expect } from '@playwright/test';
import { baseFixture } from '@civitas-cerebrum/element-interactions';

export const test = baseFixture(base, 'tests/e2e/page-repository.json', {
  timeout: 30000,
});

export { expect };
