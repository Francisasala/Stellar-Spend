import { describe, it, expect, beforeEach } from 'vitest';
import { DIContainer } from './container';
import { configureServices, validateServices } from './registry';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  describe('Singleton Lifetime', () => {
    it('should return same instance for singleton', async () => {
      const factory = () => ({ id: Math.random() });
      container.registerSingleton('service', factory);

      const instance1 = await container.resolve('service');
      const instance2 = await container.resolve('service');

      expect(instance1).toBe(instance2);
    });

    it('should cache singleton instance', async () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { id: callCount };
      };
      container.registerSingleton('service', factory);

      await container.resolve('service');
      await container.resolve('service');

      expect(callCount).toBe(1);
    });
  });

  describe('Transient Lifetime', () => {
    it('should return different instances for transient', async () => {
      const factory = () => ({ id: Math.random() });
      container.registerTransient('service', factory);

      const instance1 = await container.resolve('service');
      const instance2 = await container.resolve('service');

      expect(instance1).not.toBe(instance2);
    });

    it('should create new instance each time', async () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { id: callCount };
      };
      container.registerTransient('service', factory);

      await container.resolve('service');
      await container.resolve('service');

      expect(callCount).toBe(2);
    });
  });

  describe('Scoped Lifetime', () => {
    it('should return same instance within scope', async () => {
      const factory = () => ({ id: Math.random() });
      container.registerScoped('service', factory);
      container.createScope('scope1');

      const instance1 = await container.resolve('service', 'scope1');
      const instance2 = await container.resolve('service', 'scope1');

      expect(instance1).toBe(instance2);
    });

    it('should return different instances across scopes', async () => {
      const factory = () => ({ id: Math.random() });
      container.registerScoped('service', factory);
      container.createScope('scope1');
      container.createScope('scope2');

      const instance1 = await container.resolve('service', 'scope1');
      const instance2 = await container.resolve('service', 'scope2');

      expect(instance1).not.toBe(instance2);
    });

    it('should dispose scope', async () => {
      const factory = () => ({ id: Math.random() });
      container.registerScoped('service', factory);
      container.createScope('scope1');

      const instance1 = await container.resolve('service', 'scope1');
      container.disposeScope('scope1');
      container.createScope('scope1');
      const instance2 = await container.resolve('service', 'scope1');

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Synchronous Resolution', () => {
    it('should resolve sync services', () => {
      const factory = () => ({ id: 1 });
      container.registerSingleton('service', factory);

      const instance = container.resolveSync('service');
      expect(instance.id).toBe(1);
    });

    it('should throw on async factory', () => {
      const factory = async () => ({ id: 1 });
      container.registerSingleton('service', factory);

      expect(() => container.resolveSync('service')).toThrow();
    });
  });

  describe('Service Registration', () => {
    it('should check if service is registered', () => {
      container.registerSingleton('service', () => ({}));
      expect(container.has('service')).toBe(true);
      expect(container.has('unknown')).toBe(false);
    });

    it('should throw on unregistered service', async () => {
      await expect(container.resolve('unknown')).rejects.toThrow();
    });

    it('should get all registered services', () => {
      container.registerSingleton('service1', () => ({}));
      container.registerSingleton('service2', () => ({}));

      const services = container.getRegisteredServices();
      expect(services).toContain('service1');
      expect(services).toContain('service2');
    });
  });

  describe('Validation', () => {
    it('should validate all services', async () => {
      container.registerSingleton('service1', () => ({ id: 1 }));
      container.registerSingleton('service2', () => ({ id: 2 }));

      const result = await container.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report validation errors', async () => {
      container.registerSingleton('service1', () => {
        throw new Error('Factory error');
      });

      const result = await container.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Container Management', () => {
    it('should clear all services', async () => {
      container.registerSingleton('service', () => ({}));
      container.clear();

      expect(container.has('service')).toBe(false);
    });

    it('should throw on duplicate scope', () => {
      container.createScope('scope1');
      expect(() => container.createScope('scope1')).toThrow();
    });
  });

  describe('Service Configuration', () => {
    it('should configure services', async () => {
      configureServices(container);

      expect(container.has('QuoteService')).toBe(true);
      expect(container.has('BridgeService')).toBe(true);
      expect(container.has('PayoutService')).toBe(true);
      expect(container.has('WalletManager')).toBe(true);
    });

    it('should validate configured services', async () => {
      configureServices(container);
      await expect(validateServices(container)).resolves.not.toThrow();
    });
  });
});
