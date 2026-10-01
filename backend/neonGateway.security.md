# Gateway security model

Protected storage writes are authorized by the existing `/api/admin/session` endpoint using the caller's cookie. The gateway never stores or returns database credentials. AI and Supabase service credentials remain masked by the client sanitizer. Visitor cart/user keys are scoped to the existing visitor cookie model. The legacy backend binds to an internal loopback URL from the gateway and is not intended as a second public Railway listener.
