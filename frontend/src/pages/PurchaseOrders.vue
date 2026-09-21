<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { purchaseOrdersApi, type PurchaseOrderLineInput } from '../api/purchase-orders';
import { useInventoryStore } from '../stores/inventoryStore';
import { useSupplierStore } from '../stores/supplierStore';
import DataTable from '../components/common/DataTable.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import { PurchaseOrderStatus, PurchaseOrderStatusLabel } from '../constants/enums';
import { PERMISSIONS } from '../constants/permissions';
import { usePurchaseOrderStore } from '../stores/purchaseOrderStore';
import { formatDate } from '../utils/format';

const store = usePurchaseOrderStore();
const supplierStore = useSupplierStore();
const inventoryStore = useInventoryStore();
const orderNo = ref('');
const status = ref('');
const showCreate = ref(false);
const form = ref({
  supplierId: '',
  warehouseId: '',
  remark: '',
  items: [{ skuId: '', skuName: '', orderedQuantity: 10 }] as Array<PurchaseOrderLineInput & { orderedQuantity: number }>,
});
const submitting = ref(false);

onMounted(async () => {
  await Promise.all([store.fetchList(), supplierStore.fetchList(), inventoryStore.fetchWarehouses()]);
  form.value.supplierId = supplierStore.suppliers[0]?.id ?? '';
  form.value.warehouseId = inventoryStore.warehouses[0]?.id ?? '';
});
async function reload() {
  await store.fetchList({ orderNo: orderNo.value, status: status.value });
}
function addLine() { form.value.items.push({ skuId: '', skuName: '', orderedQuantity: 10 }); }
function removeLine(index: number) { form.value.items.splice(index, 1); }
function resetForm() {
  form.value = { supplierId: supplierStore.suppliers[0]?.id ?? '', warehouseId: inventoryStore.warehouses[0]?.id ?? '', remark: '', items: [{ skuId: '', skuName: '', orderedQuantity: 10 }] };
}
async function submit() {
  submitting.value = true;
  try {
    const items = form.value.items
      .filter((line) => line.skuId.trim() && line.skuName.trim())
      .map((line) => ({ skuId: line.skuId.trim(), skuName: line.skuName.trim(), orderedQuantity: Number(line.orderedQuantity) }));
    await purchaseOrdersApi.create({ supplierId: form.value.supplierId, warehouseId: form.value.warehouseId, remark: form.value.remark, items });
    showCreate.value = false;
    resetForm();
    await reload();
  } finally {
    submitting.value = false;
  }
}
function progressPercent(row: { overallProgress: number }) {
  return `${Math.round(row.overallProgress * 100)}%`;
}
</script>

<template>
  <section>
    <div class="page-title">
      <h2>采购订单</h2>
      <button v-permission="PERMISSIONS.PURCHASE_ORDER_WRITE" class="btn" @click="showCreate = !showCreate">{{ showCreate ? '收起' : '新建采购单' }}</button>
    </div>

    <div v-if="showCreate" class="panel create-panel">
      <h3>新建采购单</h3>
      <div class="form-row">
        <label>供应商
          <select v-model="form.supplierId">
            <option v-for="supplier in supplierStore.suppliers" :key="supplier.id" :value="supplier.id">{{ supplier.name }}</option>
          </select>
        </label>
        <label>目标仓库
          <select v-model="form.warehouseId">
            <option v-for="warehouse in inventoryStore.warehouses" :key="warehouse.id" :value="warehouse.id">{{ warehouse.name }}</option>
          </select>
        </label>
        <label class="remark">备注<input v-model="form.remark" placeholder="可选" /></label>
      </div>
      <table class="lines">
        <thead><tr><th>SKU 编码</th><th>SKU 名称</th><th style="width:140px">订购数量</th><th style="width:80px"></th></tr></thead>
        <tbody>
          <tr v-for="(line, index) in form.items" :key="index">
            <td><input v-model="line.skuId" placeholder="如 SKU-2001" /></td>
            <td><input v-model="line.skuName" placeholder="物料名称" /></td>
            <td><input v-model.number="line.orderedQuantity" type="number" min="1" /></td>
            <td><button class="mini danger" @click="removeLine(index)" :disabled="form.items.length === 1">删除</button></td>
          </tr>
        </tbody>
      </table>
      <div class="form-actions">
        <button class="btn secondary" @click="addLine">+ 添加一行</button>
        <button class="btn" :disabled="submitting" @click="submit">提交审核</button>
      </div>
    </div>

    <div class="toolbar">
      <input v-model="orderNo" placeholder="采购单号" @input="reload" />
      <select v-model="status" @change="reload">
        <option value="">全部状态</option>
        <option v-for="label of Object.values(PurchaseOrderStatus)" :key="label" :value="label">{{ PurchaseOrderStatusLabel[label] }}</option>
      </select>
    </div>
    <DataTable
      :columns="[{key:'orderNo',title:'采购单号'},{key:'supplierName',title:'供应商'},{key:'warehouseName',title:'目标仓库'},{key:'status',title:'状态'},{key:'progress',title:'到货进度'},{key:'totalPending',title:'待收总数'},{key:'createdAt',title:'创建时间'}]"
      :data="store.orders as any"
    >
      <template #status="{ row }"><StatusBadge :value="row.status" /></template>
      <template #progress="{ row }">
        <div class="progress"><div class="bar" :style="{ width: progressPercent(row) }"></div><span>{{ progressPercent(row) }}</span></div>
      </template>
      <template #createdAt="{ row }">{{ formatDate(row.createdAt) }}</template>
      <template #actions="{ row }">
        <RouterLink class="link" :to="`/purchase-orders/${row.id}`">详情</RouterLink>
      </template>
    </DataTable>
  </section>
</template>

<style scoped>
.create-panel { margin-bottom:16px; }
.create-panel h3 { margin:0 0 12px; }
.form-row { display:flex; gap:14px; margin-bottom:12px; flex-wrap:wrap; }
.form-row label { display:flex; flex-direction:column; gap:6px; font-size:13px; color:#58635e; }
.form-row .remark { flex:1; min-width:200px; }
.lines { width:100%; border-collapse:collapse; margin-bottom:12px; }
.lines th { text-align:left; font-size:13px; color:#58635e; padding:6px 8px; }
.lines input { width:100%; }
.form-actions { display:flex; justify-content:flex-end; gap:10px; }
.link { color:#175c4a; font-weight:800; }
.mini { border:0; border-radius:5px; padding:5px 10px; background:#e1e8d0; cursor:pointer; }
.mini.danger { background:#ffe0df; color:#9f1d18; }
.mini:disabled { opacity:.45; cursor:not-allowed; }
.progress { display:flex; align-items:center; gap:8px; min-width:150px; }
.progress .bar { height:8px; border-radius:4px; background:#6a9a52; }
.progress span { font-size:12px; color:#58635e; white-space:nowrap; }
</style>
