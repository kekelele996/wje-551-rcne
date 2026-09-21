INSERT INTO users (id, username, password_hash, name, email, phone, status, created_at, updated_at) VALUES
('u-admin', 'admin', 'admin123-demo-hash', '系统管理员', 'admin@example.com', '13800000000', 'ACTIVE', NOW(), NOW());

INSERT INTO roles (id, name, code, description) VALUES
('r-admin', '系统管理员', 'ADMIN', '拥有所有权限'),
('r-purchase', '采购经理', 'PURCHASE_MANAGER', '管理供应商和运单'),
('r-warehouse', '仓库经理', 'WAREHOUSE_MANAGER', '管理仓库和库存'),
('r-viewer', '只读用户', 'VIEWER', '只能查看数据');

INSERT INTO warehouses (id, name, address, capacity, status, created_at, updated_at) VALUES
('wh-east', '华东中心仓', '上海市青浦区', 80000, 'ACTIVE', NOW(), NOW()),
('wh-south', '华南前置仓', '深圳市龙岗区', 52000, 'ACTIVE', NOW(), NOW()),
('wh-north', '华北冷链仓', '天津市武清区', 36000, 'ACTIVE', NOW(), NOW());

INSERT INTO suppliers (id, name, contact, phone, email, address, status, rating, created_at, updated_at) VALUES
('sup-1', '远航包装', '陈敏', '13800001000', 'supplier1@example.com', '示例工业园1号', 'ACTIVE', 4.6, NOW(), NOW()),
('sup-2', '北辰电子', '王立', '13800001001', 'supplier2@example.com', '示例工业园2号', 'ACTIVE', 4.1, NOW(), NOW()),
('sup-3', '森谷食品', '赵欣', '13800001002', 'supplier3@example.com', '示例工业园3号', 'PENDING_REVIEW', 3.7, NOW(), NOW()),
('sup-4', '云驰配件', '刘洋', '13800001003', 'supplier4@example.com', '示例工业园4号', 'INACTIVE', 3.2, NOW(), NOW()),
('sup-5', '衡越纺织', '周琪', '13800001004', 'supplier5@example.com', '示例工业园5号', 'BLACKLISTED', 2.1, NOW(), NOW());

INSERT INTO inventories (id, warehouse_id, sku_id, sku_name, quantity, safety_stock, alert_level, updated_at) VALUES
('inv-1', 'wh-east', 'SKU-1000', '轴承组件', 12, 25, 'CRITICAL', NOW()),
('inv-2', 'wh-east', 'SKU-1001', '包装纸箱', 35, 40, 'LOW', NOW()),
('inv-3', 'wh-south', 'SKU-1002', '温控芯片', 120, 80, 'NORMAL', NOW());

INSERT INTO shipments (id, order_no, supplier_id, warehouse_id, status, tracking_no, carrier, estimated_arrival, actual_arrival, remark, created_at, updated_at) VALUES
('ship-1', 'SHIP-20260601-0001', 'sup-1', 'wh-east', 'PENDING', '', '', DATE_ADD(NOW(), INTERVAL 2 DAY), NULL, '', NOW(), NOW()),
('ship-2', 'SHIP-20260602-0002', 'sup-2', 'wh-south', 'SHIPPED', 'TRK1002', '顺丰速运', DATE_ADD(NOW(), INTERVAL 1 DAY), NULL, '', NOW(), NOW()),
('ship-3', 'SHIP-20260603-0003', 'sup-3', 'wh-north', 'IN_TRANSIT', 'TRK1003', '京东物流', DATE_ADD(NOW(), INTERVAL 1 DAY), NULL, '', NOW(), NOW()),
('ship-4', 'SHIP-20260604-0004', 'sup-1', 'wh-east', 'DELIVERED', 'TRK1004', '德邦快运', NOW(), NOW(), '', NOW(), NOW());

INSERT INTO shipment_items (id, shipment_id, sku_id, sku_name, quantity) VALUES
('si-1', 'ship-1', 'SKU-1000', '轴承组件', 20),
('si-2', 'ship-2', 'SKU-1001', '包装纸箱', 60),
('si-3', 'ship-3', 'SKU-1002', '温控芯片', 15);

INSERT INTO purchase_orders (id, order_no, supplier_id, warehouse_id, status, remark, approved_at, approver, closed_at, created_by, created_at, updated_at) VALUES
('po-1', 'PO-20260918-0001', 'sup-1', 'wh-east', 'APPROVED', '季度常备物料补货', DATE_SUB(NOW(), INTERVAL 2 DAY), '采购经理', NULL, '采购经理', DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
('po-2', 'PO-20260915-0002', 'sup-2', 'wh-south', 'PARTIAL_RECEIVED', '产线急料，分批到货', DATE_SUB(NOW(), INTERVAL 5 DAY), '采购经理', NULL, '采购经理', DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
('po-3', 'PO-20260909-0003', 'sup-1', 'wh-north', 'CLOSED', '一次性到货合格，已关闭', DATE_SUB(NOW(), INTERVAL 11 DAY), '系统管理员', DATE_SUB(NOW(), INTERVAL 10 DAY), '采购经理', DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_SUB(NOW(), INTERVAL 10 DAY));

INSERT INTO purchase_order_items (id, order_id, sku_id, sku_name, ordered_quantity, accepted_quantity) VALUES
('poi-1', 'po-1', 'SKU-1000', '轴承组件', 100, 0),
('poi-2', 'po-1', 'SKU-1010', '包装纸箱', 200, 0),
('poi-3', 'po-2', 'SKU-1002', '温控芯片', 80, 50),
('poi-4', 'po-2', 'SKU-1012', '防潮薄膜', 120, 60),
('poi-5', 'po-3', 'SKU-1004', '食品托盘', 60, 60);

INSERT INTO purchase_receipts (id, order_id, batch_no, received_quantity, accepted_quantity, rejected_quantity, operator, remark, created_at) VALUES
('pr-1', 'po-2', 'RCV-20260918-0001', 120, 110, 10, '仓库经理', '首批到货，10 件外观不合格拒收', DATE_SUB(NOW(), INTERVAL 3 DAY)),
('pr-2', 'po-3', 'RCV-20260911-0001', 60, 60, 0, '仓库经理', '全部合格', DATE_SUB(NOW(), INTERVAL 10 DAY));

INSERT INTO purchase_receipt_items (id, receipt_id, sku_id, received_quantity, accepted_quantity) VALUES
('pri-1', 'pr-1', 'SKU-1002', 55, 50),
('pri-2', 'pr-1', 'SKU-1012', 65, 60),
('pri-3', 'pr-2', 'SKU-1004', 60, 60);
