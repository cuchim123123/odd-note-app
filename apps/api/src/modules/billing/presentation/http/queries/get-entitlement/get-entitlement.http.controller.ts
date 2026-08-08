import { Controller, Get, UseGuards, Req, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import type { Request } from 'express';
import { AccessTokenGuard } from '@shared/presentation/http/guards/access-token.guard';
import { ENTITLEMENT_QUERY_DAO } from '@modules/billing/application/ports/dao/entitlement-query.dao.port';
import type { IEntitlementQueryDao, EntitlementResult } from '@modules/billing/application/ports/dao/entitlement-query.dao.port';
import { BillingEntityId } from '@modules/billing/domain/value-objects/billing-entity-id.vo';

@Controller('billing/entitlement')
export class GetEntitlementHttpController {
  constructor(
    @Inject(ENTITLEMENT_QUERY_DAO) private readonly entitlementDao: IEntitlementQueryDao,
  ) {}

  @Get()
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  async getEntitlement(
    @Req() req: Request & { user: { userId: string } },
  ): Promise<EntitlementResult | null> {
    const billingEntityId = BillingEntityId.fromUser(req.user.userId);
    return this.entitlementDao.findByBillingEntityId(billingEntityId);
  }
}
