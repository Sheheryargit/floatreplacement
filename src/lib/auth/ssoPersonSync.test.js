import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  displayNameFromSsoUser,
  jobTitleFromSsoUser,
} from "./ssoPersonFields.js";

describe("ssoPersonSync", () => {
  it("reads display name from SSO metadata", () => {
    const name = displayNameFromSsoUser({
      email: "jane.doe@deloitte.com",
      user_metadata: { full_name: "Jane Doe" },
    });
    assert.equal(name, "Jane Doe");
  });

  it("reads job title from common Azure claim keys", () => {
    const title = jobTitleFromSsoUser({
      user_metadata: { jobTitle: "Senior Consultant" },
    });
    assert.equal(title, "Senior Consultant");
  });
});
