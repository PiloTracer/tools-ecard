Below is the **rewritten, clean, concise requirement**—using **your numbering** and answering each question explicitly while incorporating all the clarified rules.

---

# **1. Configuration Source**

Use **project-level** configuration.
(No batch-level overrides needed for now; future hybrid is possible but out of scope.)

---

# **2. Work Phone Prefix**

### 2.1 Where the prefix applies

The **work phone prefix applies only to the `work_phone` field**, and only when:

* The digit-only value has **exactly 4 digits**,
* The number does **not** start with “+”,
* The total digit count is **≤ 8**,
* The number is not international and not >8 digits.

**No other phone fields** (mobile_phone, home_phone, etc.) should ever receive the prefix.

### 2.2 What about very short values like “2” or “22”?

* Any value with **1–3 digits** is treated as a **work_phone_ext**, not a phone requiring prefix.
* So `"2"`, `"22"`, `"333"` → **extension**, not a main work number.

Only **exactly 4 digits** (e.g., `"1234"`) qualify for prefix application.

---

# **3. Default Country Code**

### 3.1 Format preference

Use this exact format:
**`+(506)`**

Applied only when:

* The number has **exactly 8 digits** (after prefixing, if applicable),
* The number does **not** start with “+”,

### 3.2 Country lookup

No lookup from `business_address_country` is required at this stage.
Always use the **configured default** (`+(506)` for now).

---

# **4. E.164 Preservation**

### 4.1 Full confirmation

Yes — **any number whose original input begins with “+” must be left 100% unchanged.**

This includes:

* digits,
* spaces,
* hyphens,
* parentheses,
* formatting of any kind.

Additionally:

* Any number with **digit length <> 8 digits** is also **left unchanged**, even if it does not start with “+”, because we don't know where is it from


# Usually the number's final format will result in "+(506) 9999-9999", some examples of original numbers that will end up in this format:
99999999
9999-9999
9999 9999
9999 (in this case if a default 4 digit prefix has been defined, then this will actually turn into "9999-9999" or "99999999" at this point which is valid for adding the **+(506)** prefix)

these initial values will not change at all from the original:
999 (this is probably a work_phone_ext)
999999 (this is probably a number from other country, no change)
9 9999 (can't be parsed)
999999999 (nine digits)

# For now the priority is properly format Costa Rican compatible numbers, we'll add additional support later for other countries' phones.