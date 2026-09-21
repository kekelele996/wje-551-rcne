<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { purchaseOrdersApi } from '../api/purchaseOrders';
import DataTable from '../components/common/DataTable.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import { PurchaseOrderStatus } from '../constants/enums';
import { PERMISSIONS } from '../constants/permissions';
import { usePurchaseOrderStore } from '../stores/purchaseOrderStore';
import { formatDate } from '../utils/format';

const route = useRoute();
const store = usePurchaseOrderStore();
const id = String(route.params.id);

const showReceive = ref(false);
const submitting = ref(false);
const batchNo = ref('');
const remark = ref('');
const receiptLines = ref<Record<string, { receivedQuantity: number | null; acceptedQuantity: number | null }>>({});

onMounted(() => store.fetchDetail(id));

const order = computed(() => store.current);
const receivable = computed(() => order.value?.status === PurchaseOrderStatus.APPROVED || order.value?.status === PurchaseOrderStatus.PARTIAL_RECEIVED);

function openReceive() {
  if (!order.value) return;
  batchNo.value = `RCV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-4)}`;
  remark.value = '';
  receiptLines.value = {};
  order.value.progressItems.forEach((item) => {
    if ((item.remainingQuantity ?? 0) > 0) receiptLines.value[item.skuId] = { receivedQuantity: null, acceptedQuantity: null };
  });
  showReceive.value = true;
}

async function submitReceive() {
  if (!order.value) return;
  submitting.value = true;
  try {
    const items = Object.entries(receiptLines.value)
      .filter(([, line]) => line.receivedQuantity !== null && Number(line.receivedQuantity) > 0)
      .map(([skuId, line]) => ({ skuId, receivedQuantity: Number(line.receivedQuantity), acceptedQuantity: Number(line.acceptedQuantity ?? 0) }));
    await purchaseOrdersApi.receive(id, { batchNo: batchNo.value.trim(), remark: remark.value, items });
    showReceive.value = false;
    await store.fetchDetail(id);
  } finally {
    submitting.value = false;
  }
}

async function approve() {
  await purchaseOrdersApi.approve(id);
  await store.fetchDetail(id);
}
</script>

<template>
  <section v-if="order">
    <div class="page-title">
      <h2>{{ order.orderNo }} <StatusBadge class="title-badge" :value="order.status" /></h2>
      <div>
        <button v-if="order.status === PurchaseOrderStatus.DRAFT" v-permission="PERMISSIONS.PURCHASE_ORDER_APPROVE" class="btn" @click="approve">审核通过（冻结数量）</button>
        <button v-if="receivable" v-permission="PERMISSIONS.PURCHASE_ORDER_RECEIVE" class="btn" @click="openReceive">登记批次到货</button>
      </div>
    </div>

    <div class="grid two">
      <div class="panel">
        <h3>订单信息</h3>
        <p>供应商：{{ order.supplier?.name ?? order.supplierId }}</p>
        <p>目标仓库：{{ order.warehouse?.name ?? order.warehouseId }}</p>
        <p>创建人：{{ order.createdBy }} · {{ formatDate(order.createdAt) }}</p>
        <p>审核人：{{ order.approver ?? '-' }}<template v-if="order.approvedAt"> · {{ formatDate(order.approvedAt) }}</template></p>
        <p v-if="order.closedAt">关闭时间：{{ formatDate(order.closedAt) }}</p>
        <p>备注：{{ order.remark || '-' }}</p>
        <p v-if="order.status === PurchaseOrderStatus.CLOSED" class="locked">订单已关闭，不能改单或继续到货</p>
      </div>
      <div class="panel">
        <h3>到货汇总</h3>
        <p>累计订购：{{ order.totalOrdered }}</p>
        <p>累计到货：{{ order.totalReceived }}（含拒收）</p>
        <p>累计合格：<strong>{{ order.totalAccepted }}</strong></p>
        <p>待收数量：<strong>{{ order.totalRemaining }}</strong></p>
        <div class="overall-bar"><i :style="{ width: `${Math.min(100, (order.totalAccepted / Math.max(1, order.totalOrdered)) * 100)}%` }" /></div>
      </div>
    </div>

    <h3>明细进度</h3>
    <DataTable
      :columns="[
        { key: 'skuId', title: 'SKU 编码' },
        { key: 'skuName', title: 'SKU 名称' },
        { key: 'orderedQuantity', title: '订购' },
        { key: 'acceptedQuantity', title: '累计合格' },
        { key: 'remainingQuantity', title: '待收' },
        { key: 'progress', title: '进度' },
      ]"
      :data="order.progressItems as any"
    >
      <template #progress="{ row }">
        <div class="prog">
          <div class="bar"><i :style="{ width: `${Math.min(100, (row.acceptedQuantity / Math.max(1, row.orderedQuantity)) * 100)}%` }" /></div>
          <span>{{ Math.round((row.acceptedQuantity / Math.max(1, row.orderedQuantity)) * 100) }}%</span>
        </div>
      </template>
    </DataTable>

    <h3>到货批次（拒收品仅记录，不入目标仓库）</h3>
    <DataTable
      :columns="[
        { key: 'batchNo', title: '批次号' },
        { key: 'receivedQuantity', title: '到货数' },
        { key: 'acceptedQuantity', title: '合格数' },
        { key: 'rejectedQuantity', title: '拒收数' },
        { key: 'operator', title: '登记人' },
        { key: 'createdAt', title: '登记时间' },
      ]"
      :data="order.receipts as any"
    >
      <template #createdAt="{ row }">{{ formatDate(row.createdAt) }}</template>
    </DataTable>

    <div v-if="showReceive" class="modal-mask" @click.self="showReceive = false">
      <div class="modal panel">
        <h3>登记批次到货</h3>
        <p class="tip">批次号全局唯一；累计合格不得超过订购。任一行校验失败，整次到货不生效，订单与库存保持原样。</p>
        <label class="field">批次号<input v-model="batchNo" placeholder="唯一批次号" /></label>
        <table class="lines">
          <thead><tr><th>SKU</th><th>名称</th><th>待收</th><th style="width:120px">本次到货</th><th style="width:120px">合格数</th></tr></thead>
          <tbody>
            <tr v-for="item in order.progressItems.filter((line) => (line.remainingQuantity ?? 0) > 0)" :key="item.skuId">
              <td>{{ item.skuId }}</td>
              <td>{{ item.skuName }}</td>
              <td>{{ item.remainingQuantity }}</td>
              <td><input v-model.number="receiptLines[item.skuId].receivedQuantity" type="number" min="0" /></td>
              <td><input v-model.number="receiptLines[item.skuId].acceptedQuantity" type="number" min="0" /></td>
            </tr>
          </tbody>
        </table>
        <label class="field">备注<input v-model="remark" placeholder="拒收原因等，选填" /></label>
        <div class="modal-actions">
          <button class="btn secondary" @click="showReceive = false">取消</button>
          <button class="btn" :disabled="submitting" @click="submitReceive">{{ submitting ? '提交中…' : '确认到货' }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.title-badge { margin-left:10px; vertical-align:middle; }
.locked { color:#9f1d18; font-weight:700; }
.overall-bar { height:10px; background:#e4e8ec; border-radius:5px; overflow:hidden; margin-top:10px; }
.overall-bar i { display:block; height:100%; background:#4a7c59; }
.prog { display:flex; align-items:center; gap:8px; }
.bar { width:90px; height:8px; background:#e4e8ec; border-radius:4px; overflow:hidden; }
.bar i { display:block; height:100%; background:#4a7c59; }
h3 { margin:22px 0 10px; }
.modal-mask { position:fixed; inset:0; background:rgba(20,30,25,.45); display:flex; align-items:center; justify-content:center; z-index:20; }
.modal { width:780px; max-height:86vh; overflow:auto; }
.tip { background:#fff6df; border:1px solid #e8d49a; border-radius:6px; padding:8px 10px; font-size:13px; color:#7a4b00; }
.field { display:grid; gap:6px; font-size:13px; color:#4b5965; margin-bottom:12px; }
.lines { width:100%; border-collapse:collapse; margin-bottom:12px; }
.lines th { background:#eef1e8; color:#26352f; text-align:left; font-size:12px; padding:8px; }
.lines td { padding:6px 6px 6px 0; }
.lines input { width:100%; }
.modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:8px; }
</style>
