typedef struct NodeInner NodeInner;

typedef struct P2PNode {
  struct NodeInner *inner;
} P2PNode;

typedef struct P2PMessage {
  const char *peer_id;
  const char *topic;
  const char *data;
  uintptr_t data_len;
} P2PMessage;

typedef void (*MessageCallback)(const struct P2PMessage*);

typedef void (*PeerCallback)(const char*, bool);

struct P2PNode *p2p_node_create(void);

void p2p_node_destroy(struct P2PNode *node);

bool p2p_node_initialize(struct P2PNode *node);

bool p2p_node_start_listening(struct P2PNode *node, uint16_t port);

bool p2p_node_join_room(struct P2PNode *node, const char *room_id);

bool p2p_node_send_message(struct P2PNode *node, const uint8_t *data, uintptr_t data_len);

void p2p_set_message_callback(MessageCallback callback);

void p2p_set_peer_callback(PeerCallback callback);

bool p2p_send_history_sync(struct P2PNode *node, const char *entries_json, const char *device_id);

const char *p2p_get_peer_id(struct P2PNode *node);

void p2p_free_string(char *s);

void p2p_init_logging(void);
