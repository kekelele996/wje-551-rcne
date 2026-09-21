-- 采购订单演示数据（与内存种子 po-1 ~ po-4 对应）

INSERT INTO purchase_orders (id, order_no, supplier_id, warehouse_id, status, remark, created_by, created_at, updated_at) VALUES
('po-1', 'PO-20260901-0001', 'sup-1', 'wh-east', 'PENDING_APPROVAL', '季度补货', 'u-purchase', NOW(), NOW()),
('po-2', 'PO-20260905-0002', 'sup-2', 'wh-south', 'APPROVED', '', 'u-purchase', NOW(), NOW()),
('po-3', 'PO-20260910-0003', 'sup-1', 'wh-east', 'PARTIAL_RECEIVED', '分批到货示例', 'u-purchase', NOW(), NOW()),
('po-4', 'PO-20260912-0004', 'sup-3', 'wh-north', 'CLOSED', '一次到齐', 'u-purchase', NOW(), NOW());

INSERT INTO purchase_order_items (id, purchase_order_id, sku_id, sku_name, ordered_quantity, accepted_quantity) VALUES
('po-1-item-1', 'po-1', 'SKU-1000', '轴承组件', 100, 0),
('po-1-item-2', 'po-1', 'SKU-1001', '包装纸箱', 200, 0),
('po-2-item-1', 'po-2', 'SKU-1002', '温控芯片', 120, 0),
('po-2-item-2', 'po-2', 'SKU-1003', '食品托盘', 60, 0),
('po-3-item-1', 'po-3', 'SKU-1000', '轴承组件', 100, 60),
('po-3-item-2', 'po-3', 'SKU-1001', '包装纸箱', 80, 80),
('po-4-item-1', 'po-4', 'SKU-1004', '防潮薄膜', 40, 40);

INSERT INTO purchase_receipts (id, purchase_order_id, batch_no, operator, remark, arrived_at, created_at) VALUES
('pr-1', 'po-3', 'BATCH-20260912-01', '仓库经理', '5 件外观破损拒收', NOW(), NOW()),
('pr-2', 'po-4', 'BATCH-20260915-01', '仓库经理', '', NOW(), NOW());

INSERT INTO purchase_receipt_items (id, receipt_id, purchase_order_item_id, sku_id, sku_name, received_quantity, accepted_quantity, rejected_quantity) VALUES
('pri-1', 'pr-1', 'po-3-item-1', 'SKU-1000', '轴承组件', 65, 60, 5),
('pri-2', 'pr-1', 'po-3-item-2', 'SKU-1001', '包装纸箱', 80, 80, 0),
('pri-3', 'pr-2', 'po-4-item-1', 'SKU-1004', '防潮薄膜', 40, 40, 0);
