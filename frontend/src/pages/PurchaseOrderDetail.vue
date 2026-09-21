<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { purchaseOrdersApi, type PurchaseOrderLineInput, type PurchaseReceiptLineInput } from '../api/purchase-orders';
import DataTable from '../components/common/DataTable.vue';
import EmptyState from '../components/common/EmptyState.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import { PurchaseOrderStatus } from '../constants/enums';
import { PERMISSIONS } from '../constants/permissions';
import { usePurchaseOrderStore } from '../stores/purchaseOrderStore';
import { formatDate } from '../utils/format';

const route = useRoute();
const store = usePurchaseOrderStore();
const id = String(route.params.id);

const editing = ref(false);
const editItems = ref<Array<PurchaseOrderLineInput & { orderedQuantity: number }>>([]);
const editRemark = ref('');
const editSaving = ref(false);

const showReceive = ref(false);
const receiveSaving = ref(false);
const receiptForm = ref<{ batchNo: string; remark: string; lines: Array<{ skuId: string; receivedQuantity: number | null; acceptedQuantity: number | null }> }>({
  batchNo: `BATCH-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-4)}`,
  remark: '',
  lines: [],
});

const order = computed(() => store.current);
const receivable = computed(() => order.value && [PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIAL_RECEIVED].includes(order.value.status));
const editable = computed(() => order.value?.status === PurchaseOrderStatus.PENDING_APPROVAL);

onMounted(() => store.fetchDetail(id));

async function refresh() { await store.fetchDetail(id); }
async function approve() { await purchaseOrdersApi.approve(id); await refresh(); }
async function cancel() { await purchaseOrdersApi.cancel(id); await refresh(); }

function startEdit() {
  if (!order.value) return;
  editing.value = true;
  editRemark.value = order.value.remark;
  editItems.value = order.value.items.map((item) => ({ skuId: item.skuId, skuName: item.skuName, orderedQuantity: item.orderedQuantity }));
}
function addEditLine() { editItems.value.push({ skuId: '', skuName: '', orderedQuantity: 10 }); }
function removeEditLine(index: number) { editItems.value.splice(index, 1); }
async function saveEdit() {
  editSaving.value = true;
  try {
    const items = editItems.value
      .filter((line) => line.skuId.trim() && line.skuName.trim())
      .map((line) => ({ skuId: line.skuId.trim(), skuName: line.skuName.trim(), orderedQuantity: Number(line.orderedQuantity) }));
    await purchaseOrdersApi.update(id, { remark: editRemark.value, items });
    editing.value = false;
    await refresh();
  } finally {
    editSaving.value = false;
  }
}

function startReceive() {
  if (!order.value) return;
  showReceive.value = true;
  receiptForm.value = {
    batchNo: `BATCH-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-4)}`,
    remark: '',
    lines: order.value.items.map((item) => ({ skuId: item.skuId, receivedQuantity: null, acceptedQuantity: null })),
  };
}
async function submitReceive() {
  receiveSaving.value = true;
  try {
    const items: PurchaseReceiptLineInput[] = receiptForm.value.lines
      .filter((line) => line.receivedQuantity !== null && line.receivedQuantity > 0)
      .map((line) => ({ skuId: line.skuId, receivedQuantity: Number(line.receivedQuantity), acceptedQuantity: Number(line.acceptedQuantity ?? 0) }));
    await purchaseOrdersApi.receive(id, { batchNo: receiptForm.value.batchNo.trim(), remark: receiptForm.value.remark, items });
    showReceive.value = false;
    await refresh();
  } finally {
    receiveSaving.value = false;
  }
}

function percent(value: number) { return `${Math.round(value * 100)}%`; }
function lineName(skuId: string) { return order.value?.items.find((item) => item.skuId === skuId)?.skuName ?? skuId; }
function pending(skuId: string) { return order.value?.items.find((item) => item.skuId === skuId)?.pendingQuantity ?? 0; }
</script>

<template>
  <section v-if="order">
    <div class="page-title">
      <h2>{{ order.orderNo }}</h2>
      <StatusBadge :value="order.status" />
    </div>

    <div class="grid two">
      <div class="panel">
        <h3>采购单信息</h3>
        <p>供应商：{{ order.supplierName }}</p>
        <p>目标仓库：{{ order.warehouseName }}</p>
        <p>备注：{{ order.remark || '-' }}</p>
        <p>创建时间：{{ formatDate(order.createdAt) }}</p>
        <div class="actions">
          <button v-if="editable" v-permission="PERMISSIONS.PURCHASE_ORDER_APPROVE" class="btn" @click="approve">审核通过（冻结数量）</button>
          <button v-if="editable" v-permission="PERMISSIONS.PURCHASE_ORDER_WRITE" class="btn secondary" @click="startEdit">修改订单</button>
          <button v-if="editable" v-permission="PERMISSIONS.PURCHASE_ORDER_WRITE" class="btn secondary" @click="cancel">取消订单</button>
          <button v-if="receivable" v-permission="PERMISSIONS.PURCHASE_ORDER_RECEIVE" class="btn" @click="startReceive">登记到货</button>
        </div>
        <p v-if="order.status === PurchaseOrderStatus.CLOSED" class="hint">订单已关闭（全部合格入库），不可改单或继续到货。</p>
      </div>
      <div class="panel">
        <h3>流转记录</h3>
        <p v-for="event in order.timeline" :key="event.id" class="timeline">
          <span class="event">{{ event.note }}</span> · {{ event.operator }} · {{ formatDate(event.createdAt) }}
        </p>
      </div>
    </div>

    <div v-if="editing" class="panel edit-panel">
      <h3>修改订单（仅待审核可改，审核后冻结）</h3>
      <label class="remark-line">备注<input v-model="editRemark" /></label>
      <table class="lines">
        <thead><tr><th>SKU 编码</th><th>SKU 名称</th><th style="width:150px">订购数量</th><th style="width:80px"></th></tr></thead>
        <tbody>
          <tr v-for="(line, index) in editItems" :key="index">
            <td><input v-model="line.skuId" /></td>
            <td><input v-model="line.skuName" /></td>
            <td><input v-model.number="line.orderedQuantity" type="number" min="1" /></td>
            <td><button class="mini danger" @click="removeEditLine(index)" :disabled="editItems.length === 1">删除</button></td>
          </tr>
        </tbody>
      </table>
      <div class="form-actions">
        <button class="btn secondary" @click="addEditLine">+ 添加一行</button>
        <button class="btn secondary" @click="editing = false">放弃</button>
        <button class="btn" :disabled="editSaving" @click="saveEdit">保存</button>
      </div>
    </div>

    <div v-if="showReceive" class="panel edit-panel">
      <h3>登记到货</h3>
      <div class="receive-head">
        <label>批次号（全局唯一）<input v-model="receiptForm.batchNo" /></label>
        <label class="remark-line">备注<input v-model="receiptForm.remark" placeholder="拒收原因等，可选" /></label>
      </div>
      <table class="lines">
        <thead>
          <tr><th>SKU</th><th>名称</th><th>待收</th><th style="width:150px">本次到货数</th><th style="width:150px">合格数</th><th>拒收数</th></tr>
        </thead>
        <tbody>
          <tr v-for="(line, index) in receiptForm.lines" :key="line.skuId">
            <td>{{ line.skuId }}</td>
            <td>{{ lineName(line.skuId) }}</td>
            <td>{{ pending(line.skuId) }}</td>
            <td><input v-model.number="line.receivedQuantity" type="number" min="0" /></td>
            <td><input v-model.number="line.acceptedQuantity" type="number" min="0" :max="pending(line.skuId)" /></td>
            <td>{{ Math.max(0, Number(line.receivedQuantity ?? 0) - Number(line.acceptedQuantity ?? 0)) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="hint">整批一次生效：批次号重复或累计合格超过订购时，本次登记全部不生效，订单与库存保持原样。</p>
      <div class="form-actions">
        <button class="btn secondary" @click="showReceive = false">放弃</button>
        <button class="btn" :disabled="receiveSaving" @click="submitReceive">确认入库</button>
      </div>
    </div>

    <h3>订购明细与到货进度</h3>
    <DataTable
      :columns="[{key:'skuId',title:'SKU'},{key:'skuName',title:'名称'},{key:'orderedQuantity',title:'订购'},{key:'acceptedQuantity',title:'累计合格'},{key:'pendingQuantity',title:'待收'},{key:'progress',title:'进度'},{key:'lineStatus',title:'行状态'}]"
      :data="order.items as any"
    >
      <template #progress="{ row }">
        <div class="progress"><div class="bar" :style="{ width: percent(row.progress) }"></div><span>{{ percent(row.progress) }}</span></div>
      </template>
      <template #lineStatus="{ row }">
        <span v-if="row.lineStatus === 'DONE'" class="tag ok">已收齐</span>
        <span v-else-if="row.lineStatus === 'PARTIAL'" class="tag warn">部分到货</span>
        <span v-else class="tag muted">待到货</span>
      </template>
    </DataTable>
    <p class="summary">合计：订购 {{ order.totalOrdered }} ｜ 累计合格 {{ order.totalAccepted }} ｜ 待收 {{ order.totalPending }} ｜ 总进度 {{ percent(order.overallProgress) }}</p>

    <h3>到货批次（{{ order.receipts.length }}）</h3>
    <EmptyState v-if="!order.receipts.length" />
    <div v-for="receipt in order.receipts" :key="receipt.id" class="panel receipt">
      <div class="receipt-head">
        <strong>{{ receipt.batchNo }}</strong>
        <span>{{ formatDate(receipt.arrivedAt) }} · {{ receipt.operator }}</span>
        <span v-if="receipt.remark" class="reject-note">备注：{{ receipt.remark }}</span>
      </div>
      <DataTable
        :columns="[{key:'skuId',title:'SKU'},{key:'skuName',title:'名称'},{key:'receivedQuantity',title:'到货数'},{key:'acceptedQuantity',title:'合格数（已入库）'},{key:'rejectedQuantity',title:'拒收数'}]"
        :data="receipt.items as any"
      >
        <template #rejectedQuantity="{ row }">
          <span :class="{ rejected: row.rejectedQuantity > 0 }">{{ row.rejectedQuantity }}</span>
        </template>
      </DataTable>
    </div>
  </section>
</template>

<style scoped>
.actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
.hint { color:#7a4b00; font-size:13px; margin-top:10px; }
.timeline { margin:6px 0; font-size:13px; color:#58635e; }
.event { font-weight:700; color:#1e2a25; }
.edit-panel { margin:16px 0; }
.remark-line { display:flex; flex-direction:column; gap:6px; font-size:13px; color:#58635e; margin-bottom:12px; max-width:320px; }
.lines { width:100%; border-collapse:collapse; margin-bottom:12px; }
.lines th { text-align:left; font-size:13px; color:#58635e; padding:6px 8px; }
.lines input { width:100%; }
.form-actions { display:flex; justify-content:flex-end; gap:10px; }
.receive-head { display:flex; gap:16px; margin-bottom:12px; flex-wrap:wrap; }
.receive-head label { display:flex; flex-direction:column; gap:6px; font-size:13px; color:#58635e; }
.mini { border:0; border-radius:5px; padding:5px 10px; background:#e1e8d0; cursor:pointer; }
.mini.danger { background:#ffe0df; color:#9f1d18; }
.mini:disabled { opacity:.45; cursor:not-allowed; }
.progress { display:flex; align-items:center; gap:8px; min-width:150px; }
.progress .bar { height:8px; border-radius:4px; background:#6a9a52; }
.progress span { font-size:12px; color:#58635e; white-space:nowrap; }
.tag { border-radius:5px; padding:3px 8px; font-size:12px; font-weight:700; }
.tag.ok { background:#dff4e7; color:#17613a; }
.tag.warn { background:#fff0c2; color:#7a4b00; }
.tag.muted { background:#e9edf0; color:#4b5965; }
.summary { font-weight:700; margin:10px 0 18px; }
.receipt { margin-bottom:14px; }
.receipt-head { display:flex; gap:14px; align-items:center; margin-bottom:10px; font-size:13px; color:#58635e; flex-wrap:wrap; }
.reject-note { color:#9f1d18; }
.rejected { color:#9f1d18; font-weight:800; }
h3 { margin-top:20px; }
</style>
