import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ErrorHandler } from '@/lib/error-handler';
import {
  getFeatureFlags,
  setFlagOverrides,
  clearFlagOverrides,
} from '@/lib/feature-flags';
import type { FeatureFlags } from '@/lib/feature-flags';
import { requireApiKeyAdmin } from '@/app/api/api-keys/_utils';
import { validateBody } from '@/lib/validation/validate-request';

// Mirrors the shape of FeatureFlagSchema (src/lib/feature-flags/schema.ts)
// but every field is `.optional()` rather than `.default()` — an override
// is deep-merged over the current flags, so an absent key must stay absent
// after validation rather than being filled with a default that would then
// incorrectly overwrite the existing value for that key.
const gradualRolloutOverrideSchema = z.object({
  enabled: z.boolean().optional(),
  percentage: z.number().min(0).max(1).optional(),
  seed: z.string().optional(),
});

const boolOrRolloutOverride = z.union([z.boolean(), gradualRolloutOverrideSchema]);

const featureFlagOverridesSchema = z
  .object({
    corridors: z
      .object({
        nigeriaNgn: boolOrRolloutOverride.optional(),
        kenyaKes: boolOrRolloutOverride.optional(),
        ghanaGhs: boolOrRolloutOverride.optional(),
        brazilBrl: gradualRolloutOverrideSchema.optional(),
        mexicoMxn: gradualRolloutOverrideSchema.optional(),
      })
      .optional(),
    providers: z
      .object({
        paycrestV2: boolOrRolloutOverride.optional(),
        allbridgeV2: gradualRolloutOverrideSchema.optional(),
      })
      .optional(),
    experiments: z
      .object({
        newQuoteEngine: gradualRolloutOverrideSchema.optional(),
        instantSettlement: boolOrRolloutOverride.optional(),
        batchPayouts: gradualRolloutOverrideSchema.optional(),
        webhookV2: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const unauthorized = requireApiKeyAdmin(request);
  if (unauthorized) return unauthorized;

  const userId = request.nextUrl.searchParams.get('userId') ?? undefined;

  try {
    const flags = await getFeatureFlags(userId);
    return NextResponse.json({ data: flags });
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}

export async function PUT(request: NextRequest) {
  const unauthorized = requireApiKeyAdmin(request);
  if (unauthorized) return unauthorized;

  const validation = await validateBody(request, featureFlagOverridesSchema);
  if (!validation.success) return validation.response;

  try {
    await setFlagOverrides(validation.data as Partial<FeatureFlags>);
    return NextResponse.json({ data: { message: 'Feature flag overrides applied' } });
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = requireApiKeyAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await clearFlagOverrides();
    return NextResponse.json({ data: { message: 'Feature flag overrides cleared' } });
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}
