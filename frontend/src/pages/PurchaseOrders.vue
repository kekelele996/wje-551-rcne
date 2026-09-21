<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { purchaseOrdersApi } from '../api/purchaseOrders';
import DataTable from '../components/common/DataTable.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import WarehouseSelector from '../components/common/WarehouseSelector.vue';
import { PurchaseOrderStatus, PurchaseOrderStatusLabel } from '../constants/enums';
import { PERMISSIONS } from '../constants/permissions';
import { useInventoryStore } from '../stores/inventoryStore';
import { usePurchaseOrderStore } from '../stores/purchaseOrderStore';
import { useSupplierStore } from '../stores/supplierStore';
import { formatDate } from '../utils/format';

const store = usePurchaseOrderStore();
const inventoryStore = useInventoryStore();
const supplierStore = useSupplierStore();
const status = ref('');
const warehouseId = ref('');
const showCreate = ref(false);

const formSupplierId = ref('');
const formWarehouseId = ref('wh-east');
const formRemark = ref('');
const formItems = ref<Array<{ skuId: string; skuName: string; quantity: number }>>([{ skuId: '', skuName: '', quantity: 1 }]);
const submitting = ref(false);

onMounted(async () => {
  supplierStore.filters.status = 'ACTIVE';
  await Promise.all([store.fetchList(), inventoryStore.fetchWarehouses(), supplierStore.fetchList()]);
  formWarehouseId.value = inventoryStore.warehouses[0]?.id ?? '';
});

async function reload() {
  await store.fetchList({ status: status.value, warehouseId: warehouseId.value });
}

function addLine() { formItems.value.push({ skuId: '', skuName: '', quantity: 1 }); }
function removeLine(index: number) {
  if (formItems.value.length === 1) return;
  formItems.value.splice(index, 1);
}
function openCreate() {
  formSupplierId.value = supplierStore.suppliers[0]?.id ?? '';
  formWarehouseId.value = inventoryStore.warehouses[0]?.id ?? '';
  formRemark.value = '';
  formItems.value = [{ skuId: '', skuName: '', quantity: 1 }];
  showCreate.value = true;
}
async function submitCreate() {
  submitting.value = true;
  try {
    await purchaseOrdersApi.create({
      supplierId: formSupplierId.value,
      warehouseId: formWarehouseId.value,
      remark: formRemark.value,
      items: formItems.value.map((line) => ({ skuId: line.skuId.trim(), skuName: line.skuName.trim(), quantity: Number(line.quantity) })),
    });
    showCreate.value = false;
    await reload();
  } finally {
    submitting.value = false;
  }
}

async function approve(id: string) {
  await purchaseOrdersApi.approve(id);
  await reload();
}

function progressText(row: any) {
  return `${row.totalAccepted} / ${row.totalOrdered}`;
}
</script>

<template>
  <section>
    <div class="page-title">
      <h2>采购订单</h2>
      <button v-permission="PERMISSIONS.PURCHASE_ORDER_WRITE" class="btn" @click="openCreate">新增采购订单</button>
    </div>
    <div class="toolbar">
      <WarehouseSelector v-model="warehouseId" @change="reload" />
      <select v-model="status" @change="reload">
        <option value="">全部状态</option>
        <option v-for="item in Object.values(PurchaseOrderStatus)" :key="item" :value="item">{{ PurchaseOrderStatusLabel[item] }}</option>
      </select>
    </div>
    <DataTable
      :columns="[
        { key: 'orderNo', title: '采购单号' },
        { key: 'supplierId', title: '供应商' },
        { key: 'warehouseId', title: '目标仓库' },
        { key: 'status', title: '状态' },
        { key: 'progress', title: '累计合格 / 订购' },
        { key: 'totalRemaining', title: '待收' },
        { key: 'createdAt', title: '创建时间' },
      ]"
      :data="store.orders as any"
      :loading="store.loading"
    >
      <template #supplierId="{ row }">{{ row.supplier?.name ?? row.supplierId }}</template>
      <template #warehouseId="{ row }">{{ row.warehouse?.name ?? row.warehouseId }}</template>
      <template #status="{ row }"><StatusBadge :value="row.status" /></template>
      <template #progress="{ row }">
        <div class="prog">
          <div class="bar"><i :style="{ width: `${Math.min(100, (row.totalAccepted / Math.max(1, row.totalOrdered)) * 100)}%` }" /></div>
          <span>{{ progressText(row) }}</span>
        </div>
      </template>
      <template #createdAt="{ row }">{{ formatDate(row.createdAt) }}</template>
      <template #actions="{ row }">
        <RouterLink class="link" :to="`/purchase-orders/${row.id}`">详情</RouterLink>
        <button
          v-if="row.status === PurchaseOrderStatus.DRAFT"
          v-permission="PERMISSIONS.PURCHASE_ORDER_APPROVE"
          class="mini"
          @click="approve(row.id)"
        >审核</button>
      </template>
    </DataTable>

    <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
      <div class="modal panel">
        <h3>新增采购订单</h3>
        <div class="form-row">
          <label>供应商
            <select v-model="formSupplierId">
              <option v-for="supplier in supplierStore.suppliers" :key="supplier.id" :value="supplier.id">{{ supplier.name }}</option>
            </select>
          </label>
          <label>目标仓库
            <WarehouseSelector v-model="formWarehouseId" />
          </label>
        </div>
        <table class="lines">
          <thead><tr><th>SKU 编码</th><th>SKU 名称</th><th style="width:120px">订购数量</th><th style="width:70px"></th></tr></thead>
          <tbody>
            <tr v-for="(line, index) in formItems" :key="index">
              <td><input v-model="line.skuId" placeholder="如 SKU-2001" /></td>
              <td><input v-model="line.skuName" placeholder="如 密封胶圈" /></td>
              <td><input v-model.number="line.quantity" type="number" min="1" /></td>
              <td><button class="mini danger" @click="removeLine(index)">删</button></td>
            </tr>
          </tbody>
        </table>
        <button class="btn secondary add" @click="addLine">+ 添加一行</button>
        <label class="remark">备注<input v-model="formRemark" placeholder="选填" /></label>
        <div class="modal-actions">
          <button class="btn secondary" @click="showCreate = false">取消</button>
          <button class="btn" :disabled="submitting" @click="submitCreate">{{ submitting ? '提交中…' : '提交（待审核）' }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.link { color:#175c4a; font-weight:800; margin-right:8px; }
.mini { margin-right:5px; border:0; border-radius:5px; padding:5px 8px; background:#e1e8d0; cursor:pointer; }
.mini.danger { background:#f3d7d5; color:#9f1d18; }
.prog { display:flex; align-items:center; gap:8px; }
.bar { width:90px; height:8px; background:#e4e8ec; border-radius:4px; overflow:hidden; }
.bar i { display:block; height:100%; background:#4a7c59; }
.modal-mask { position:fixed; inset:0; background:rgba(20,30,25,.45); display:flex; align-items:center; justify-content:center; z-index:20; }
.modal { width:760px; max-height:86vh; overflow:auto; }
.form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
.form-row label, .remark { display:grid; gap:6px; font-size:13px; color:#4b5965; }
.lines { width:100%; border-collapse:collapse; margin-bottom:10px; }
.lines th { background:#eef1e8; color:#26352f; text-align:left; font-size:12px; padding:8px; }
.lines td { padding:6px 6px 6px 0; }
.lines input { width:100%; }
.add { margin-bottom:12px; }
.modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:14px; }
</style>
