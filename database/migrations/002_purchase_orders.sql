-- 采购订单与分批到货闭环
-- 状态：PENDING_APPROVAL 待审核 / APPROVED 待到货（审核后数量冻结）
--       PARTIAL_RECEIVED 部分到货 / CLOSED 已关闭（全部合格）/ CANCELLED 已取消

CREATE TABLE purchase_orders (
  id VARCHAR(36) PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL,
  supplier_id VARCHAR(36) NOT NULL,
  warehouse_id VARCHAR(36) NOT NULL,
  status ENUM('PENDING_APPROVAL','APPROVED','PARTIAL_RECEIVED','CLOSED','CANCELLED') NOT NULL DEFAULT 'PENDING_APPROVAL',
  remark TEXT,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_purchase_orders_order_no (order_no),
  INDEX idx_purchase_orders_supplier_id (supplier_id),
  INDEX idx_purchase_orders_warehouse_id (warehouse_id),
  INDEX idx_purchase_orders_status (status)
);

CREATE TABLE purchase_order_items (
  id VARCHAR(36) PRIMARY KEY,
  purchase_order_id VARCHAR(36) NOT NULL,
  sku_id VARCHAR(64) NOT NULL,
  sku_name VARCHAR(128) NOT NULL,
  ordered_quantity INT NOT NULL,
  -- 累计合格入库数量；应用层保证 ordered/accepted 单调且 accepted <= ordered，
  -- 超收登记整事务回滚，因此库存与订单保持原样
  accepted_quantity INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_purchase_order_items_order_sku (purchase_order_id, sku_id),
  INDEX idx_purchase_order_items_order_id (purchase_order_id)
);

-- 到货批次：批次号全局唯一，重复批次整次登记不生效
CREATE TABLE purchase_receipts (
  id VARCHAR(36) PRIMARY KEY,
  purchase_order_id VARCHAR(36) NOT NULL,
  batch_no VARCHAR(64) NOT NULL,
  operator VARCHAR(64) NOT NULL,
  remark TEXT,
  arrived_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uk_purchase_receipts_batch_no (batch_no),
  INDEX idx_purchase_receipts_order_id (purchase_order_id)
);

-- 批次明细：拒收品只在此留痕（rejected_quantity），不写入 inventories
CREATE TABLE purchase_receipt_items (
  id VARCHAR(36) PRIMARY KEY,
  receipt_id VARCHAR(36) NOT NULL,
  purchase_order_item_id VARCHAR(36) NOT NULL,
  sku_id VARCHAR(64) NOT NULL,
  sku_name VARCHAR(128) NOT NULL,
  received_quantity INT NOT NULL,
  accepted_quantity INT NOT NULL,
  rejected_quantity INT NOT NULL,
  INDEX idx_purchase_receipt_items_receipt_id (receipt_id),
  CONSTRAINT chk_accepted_not_over_received CHECK (accepted_quantity <= received_quantity),
  CONSTRAINT chk_quantities_non_negative CHECK (received_quantity >= 0 AND accepted_quantity >= 0 AND rejected_quantity >= 0)
);
