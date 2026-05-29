import * as dotenv from "dotenv";
dotenv.config();
import { db } from "./src/server/db/index";
import { CustomerStage } from "@prisma/client";

async function main() {
  try {
    console.log("Testing DB connection...");
    const org = await db.organization.findFirst();
    if (!org) {
      console.log("No organization found. Cannot test create customer.");
      process.exit(0);
    }
    console.log("Found organization:", org.id);
    
    const customer = await db.customer.create({
      data: {
        organizationId: org.id,
        name: "打撒打算",
        contactName: "11",
        email: "11@qq.com",
        phone: "111",
        industry: "123",
        size: "1-50人",
        budget: 213123,
        stage: CustomerStage.LEAD,
      },
    });
    console.log("Customer created successfully:", customer.id);
  } catch (error) {
    console.error("Error creating customer:", error);
  }
}
main();
