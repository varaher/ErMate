import re

with open('firestore.rules', 'r') as f:
    content = f.read()

# 1. Patch users create
old_users_create = r"      allow create: if isLoggedIn\(\) && isOwner\(userId\)\n        && incoming\(\)\.name is string && incoming\(\)\.name\.size\(\) <= 100\n        && incoming\(\)\.email is string && incoming\(\)\.email\.size\(\) <= 100\n        && incoming\(\)\.role in \['EM Resident', 'Resident', 'resident', 'Doctor', 'Physician', 'Emergency Physician'\]\n        && incoming\(\)\.hospital is string && incoming\(\)\.hospital\.size\(\) <= 100\n        // New accounts start with fixed defaults only — no self-chosen credits/tier\.\n        && incoming\(\)\.get\('aiCredits', 100\) == 100\n        && incoming\(\)\.get\('streak', 1\) == 1\n        && incoming\(\)\.get\('subscriptionTier', 'Free Standard'\) is string;"

new_users_create = """      allow create: if isLoggedIn() && isOwner(userId)
        && incoming().name is string && incoming().name.size() <= 100
        && incoming().email is string && incoming().email.size() <= 100
        && incoming().role in ['EM Resident', 'Resident', 'resident', 'Doctor', 'Physician', 'Emergency Physician']
        && incoming().hospital is string && incoming().hospital.size() <= 100
        // SECURE HOSPITAL ASSIGNMENT: Prevents arbitrary self-assignment to protected hospitals
        && (
             !exists(/databases/$(database)/documents/hospital_subscriptions/$(incoming().hospital))
             || incoming().get('subscriptionTier', '') == 'Hospital Team Premium (Department Covered)'
             || isPlatformAdmin()
        )
        // New accounts start with fixed defaults only — no self-chosen credits/tier.
        && incoming().get('aiCredits', 100) == 100
        && incoming().get('streak', 1) == 1
        && incoming().get('subscriptionTier', 'Free Standard') is string;"""

content = re.sub(old_users_create, new_users_create, content)

# 2. Patch users update
old_users_update = r"          \(            isOwner\(userId\)\n            && \(!\('role' in incoming\(\)\) || incoming\(\)\.role == existing\(\)\.role\)\n            && \(!\('aiCredits' in incoming\(\)\) || incoming\(\)\.aiCredits == existing\(\)\.aiCredits\)\n            && \(!\('subscriptionTier' in incoming\(\)\) || incoming\(\)\.subscriptionTier == existing\(\)\.subscriptionTier\)\n          \)"

new_users_update = """          (
            isOwner(userId)
            && (!('role' in incoming()) || incoming().role == existing().role)
            // PREVENT HOSPITAL SPOOFING: Only allow if explicitly using the trusted transition flag
            && (
              (!('hospital' in incoming()) || incoming().hospital == existing().hospital)
              || incoming().get('subscriptionTransitionPending', false) == true
            )
            && (
              (!('subscriptionTier' in incoming()) || incoming().subscriptionTier == existing().subscriptionTier)
              || incoming().get('subscriptionTransitionPending', false) == true
            )
            && (!('aiCredits' in incoming()) || incoming().aiCredits == existing().aiCredits)
          )"""

content = re.sub(old_users_update, new_users_update, content)

# 3. Patch cases
old_cases = r"    match /cases/\{caseId\} \{\n      allow read, update, delete: if sameHospital\(resource\.data\.hospital\);\n      allow create: if isLoggedIn\(\) && sameHospital\(incoming\(\)\.hospital\);"

new_cases = """    match /cases/{caseId} {
      allow read, delete: if sameHospital(resource.data.hospital);
      allow create: if isLoggedIn() && sameHospital(incoming().hospital);
      allow update: if sameHospital(resource.data.hospital)
        && (incoming().hospital == existing().hospital || isPlatformAdmin());"""

content = re.sub(old_cases, new_cases, content)

# 4. Patch handovers
old_handovers = r"    match /handovers/\{handoverId\} \{\n      allow read, update, delete: if sameHospital\(resource\.data\.hospital\);\n      allow create: if isLoggedIn\(\) && sameHospital\(incoming\(\)\.hospital\);\n    \}"

new_handovers = """    match /handovers/{handoverId} {
      allow read, delete: if sameHospital(resource.data.hospital);
      allow create: if isLoggedIn() && sameHospital(incoming().hospital);
      allow update: if sameHospital(resource.data.hospital)
        && (incoming().hospital == existing().hospital || isPlatformAdmin());
    }"""

content = re.sub(old_handovers, new_handovers, content)

# 5. Patch quick paste
old_quick_paste = r"    match /quick_paste_patients/\{itemId\} \{\n      allow read: if isLoggedIn\(\);\n      allow create, update, delete: if isLoggedIn\(\);\n    \}"

new_quick_paste = """    match /quick_paste_patients/{itemId} {
      allow read, delete: if isLoggedIn() && (
        (resource.data.hospital != null && resource.data.hospital != "" && sameHospital(resource.data.hospital)) ||
        (resource.data.createdByEmail == request.auth.token.email) ||
        (resource.data.createdBy == request.auth.uid)
      );
      allow create: if isLoggedIn() && (
        (incoming().hospital != null && incoming().hospital != "" && sameHospital(incoming().hospital)) ||
        (incoming().createdByEmail == request.auth.token.email) ||
        (incoming().createdBy == request.auth.uid)
      );
      allow update: if isLoggedIn() && (
        (resource.data.hospital != null && resource.data.hospital != "" && sameHospital(resource.data.hospital)) ||
        (resource.data.createdByEmail == request.auth.token.email) ||
        (resource.data.createdBy == request.auth.uid)
      ) && (
        (!('hospital' in incoming()) || incoming().hospital == existing().hospital) &&
        (!('createdByEmail' in incoming()) || incoming().createdByEmail == existing().createdByEmail) &&
        (!('createdBy' in incoming()) || incoming().createdBy == existing().createdBy) || isPlatformAdmin()
      );
    }"""

content = re.sub(old_quick_paste, new_quick_paste, content)

with open('firestore.rules', 'w') as f:
    f.write(content)

