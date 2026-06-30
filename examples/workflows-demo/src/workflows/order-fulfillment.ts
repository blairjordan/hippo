import { z } from "zod"
import { defineWorkflow, task, end } from "pygmyhippo-sdk"

const orderInputSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  amount: z.number(),
  items: z.array(z.string()),
})

export const orderFulfillmentWorkflow = defineWorkflow({
  name: "order-fulfillment",
  version: 1,
  title: "Saga Order Fulfillment Workflow",
  startAt: "reserve-inventory",
  steps: {
    "reserve-inventory": task({
      input: orderInputSchema,
      next: "charge-payment",
      compensate: {
        run: async (ctx, cause) => {
          console.log(`[Saga Compensation] Releasing inventory for order ${String(ctx.input.orderId)}. Cause: ${String(cause)}`)
        },
      },
      run: async (ctx) => {
        console.log(`[Saga Step 1] Reserving inventory for order ${String(ctx.input.orderId)} with items: ${ctx.input.items.join(", ")}`)
        return {
          patch: { inventoryReserved: true },
        }
      },
    }),
    "charge-payment": task({
      input: orderInputSchema,
      next: "dispatch-shipping",
      compensate: {
        run: async (ctx, cause) => {
          console.log(`[Saga Compensation] Refund payment of $${String(ctx.input.amount)} for order ${String(ctx.input.orderId)}. Cause: ${String(cause)}`)
        },
      },
      run: async (ctx) => {
        console.log(`[Saga Step 2] Charging customer ${String(ctx.input.customerId)} card for amount $${String(ctx.input.amount)}`)
        return {
          patch: { paymentCharged: true },
        }
      },
    }),
    "dispatch-shipping": task({
      input: orderInputSchema,
      next: "complete-order",
      run: async (ctx) => {
        console.log(`[Saga Step 3] Dispatching shipping for order ${String(ctx.input.orderId)}`)
        // Trigger simulated failure to showcase compensations
        if (ctx.input.amount === 999) {
          throw new Error("Simulated shipping carrier connection timeout (triggering Saga rollback)")
        }
        return {
          patch: { shippingDispatched: true },
        }
      },
    }),
    "complete-order": end({
      label: "Order Fulfilled Successfully",
    }),
  },
})
