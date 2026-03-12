import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// getTransactions -- Authenticated callable
//
// Returns paginated transaction history for the authenticated user.
// Supports filtering by transaction type and vault slug.
// Ordered by timestamp descending with cursor-based pagination.
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const VALID_TYPES = [
  "DEPOSIT",
  "WITHDRAW",
  "REWARD_CLAIM",
  "COOLDOWN_STARTED",
  "COOLDOWN_CANCELLED",
] as const;

interface GetTransactionsRequest {
  pageSize?: number;
  filterType?: string;
  filterVaultSlug?: string;
  startAfterTimestamp?: number;
}

interface TransactionResult {
  type: string;
  amount: number;
  vaultId: number;
  vaultSlug: string;
  vaultName: string;
  timestamp: number;
  status: string;
  signature: string;
  pointsAwarded: number;
}

interface GetTransactionsResponse {
  transactions: TransactionResult[];
  hasMore: boolean;
}

export const getTransactions = onCall(
  { region: "us-central1", maxInstances: 20 },
  async (request): Promise<GetTransactionsResponse> => {
    // -- Auth check ---------------------------------------------------------

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const wallet = request.auth.uid;
    const data = request.data as GetTransactionsRequest;

    // -- Validate inputs ----------------------------------------------------

    let pageSize = data.pageSize ?? DEFAULT_PAGE_SIZE;
    if (typeof pageSize !== "number" || pageSize < 1) {
      pageSize = DEFAULT_PAGE_SIZE;
    }
    pageSize = Math.min(pageSize, MAX_PAGE_SIZE);

    if (data.filterType !== undefined) {
      if (!(VALID_TYPES as readonly string[]).includes(data.filterType)) {
        throw new HttpsError(
          "invalid-argument",
          `Invalid filterType. Must be one of: ${VALID_TYPES.join(", ")}`,
        );
      }
    }

    if (data.filterVaultSlug !== undefined && typeof data.filterVaultSlug !== "string") {
      throw new HttpsError("invalid-argument", "filterVaultSlug must be a string");
    }

    if (
      data.startAfterTimestamp !== undefined &&
      (typeof data.startAfterTimestamp !== "number" || !Number.isFinite(data.startAfterTimestamp))
    ) {
      throw new HttpsError("invalid-argument", "startAfterTimestamp must be a valid number");
    }

    // -- Build query --------------------------------------------------------

    const db = getFirestore();
    const txRef = db
      .collection("users")
      .doc(wallet)
      .collection("transactions");

    let query: FirebaseFirestore.Query = txRef.orderBy("timestamp", "desc");

    if (data.filterType) {
      query = query.where("type", "==", data.filterType);
    }

    if (data.filterVaultSlug) {
      query = query.where("vaultSlug", "==", data.filterVaultSlug);
    }

    if (data.startAfterTimestamp !== undefined) {
      query = query.startAfter(data.startAfterTimestamp);
    }

    // Fetch one extra to determine if there are more results
    query = query.limit(pageSize + 1);

    // -- Execute query ------------------------------------------------------

    const snapshot = await query.get();
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;

    const results = docs.slice(0, pageSize);

    const transactions: TransactionResult[] = results.map((doc) => {
      const d = doc.data();
      return {
        type: d.type,
        amount: d.amount,
        vaultId: d.vaultId,
        vaultSlug: d.vaultSlug,
        vaultName: d.vaultName ?? "",
        timestamp: d.timestamp instanceof Timestamp ? d.timestamp.toMillis() : d.timestamp,
        status: d.status,
        signature: d.signature,
        pointsAwarded: d.pointsAwarded ?? 0,
      };
    });

    return { transactions, hasMore };
  },
);
