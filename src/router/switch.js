import Zoom from '../views/control/Zoom.vue';
import ScaleLine from '../views/control/ScaleLine.vue';
import OverviewMap from '../views/control/OverviewMap.vue';
import MousePosition from '../views/control/MousePosition.vue';
import MapOper from '../views/control/MapOper.vue';
import LayerManage from '../views/control/LayerManage.vue';

export default [
    { name: 'Zoom', component: Zoom },
    { name: 'ScaleLine', component: ScaleLine },
    { name: 'OverviewMap', component: OverviewMap },
    { name: 'MousePosition', component: MousePosition },
    { name: 'MapOper', component: MapOper },
    { name: 'LayerManage', component: LayerManage }
];
