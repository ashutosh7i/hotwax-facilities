import { ActionTree } from 'vuex'
import RootState from '@/store/RootState'
import FacilityState from './FacilityState'
import emitter from '@/event-bus'
import { FacilityService } from '@/services/FacilityService'
import { hasError } from '@/adapter'
import * as types from './mutation-types'
import logger from '@/logger'

const actions: ActionTree<FacilityState, RootState> = {
  async fetchFacilities({ commit, dispatch, state }, payload) {
    if (payload.viewIndex === 0) emitter.emit("presentLoader");
    const filters = {
      'parentFacilityTypeId': 'VIRTUAL_FACILITY',
      'parentFacilityTypeId_op': 'notEqual'
    } as any

    if(state.query.productStoreId) {
      filters['productStoreId'] = state.query.productStoreId
      filters['productStoreId_op'] = 'equals'
    }

    if(state.query.facilityTypeId) {
        filters['facilityTypeId'] = state.query.facilityTypeId
        filters['facilityTypeId_op'] = 'equals'
    }

    if(state.query.queryString) {
      filters['facilityId_value'] = state.query.queryString
      filters['facilityId_op'] = 'contains'
      filters['facilityId_ic'] = 'Y'
      filters['facilityId_grp'] = '1'
      filters['facilityName_value'] = state.query.queryString
      filters['facilityName_op'] = 'contains'
      filters['facilityName_ic'] = 'Y'
      filters['facilityName_grp'] = '2'
    }

    const params = {
      "inputFields": {
        ...filters
      },
      "entityName": "FacilityAndProductStore",
      "noConditionFind": "Y",
      "distinct": "Y",
      "fieldList": ['facilityId', 'facilityName', 'facilityTypeId', 'maximumOrderLimit'],
      ...payload
    }

    let facilities = [], total = 0;

    try {
      const resp = await FacilityService.fetchFacilities(params)

      if(!hasError(resp) && resp.data.count) {
        facilities = resp.data.docs
        if(payload.viewIndex && payload.viewIndex > 0) facilities = JSON.parse(JSON.stringify(state.facilities.list)).concat(resp.data.docs)
        total = resp.data.count

        // make api calls in parallel
        const facilityOnlineGroupInformation = await FacilityService.fetchFacilityOnlineGroupInformation(facilities.map((facility: any) => facility.facilityId))
        const facilitiesOrderCount = await FacilityService.fetchFacilitiesOrderCount(facilities.map((facility: any) => facility.facilityId))

        console.log('facilitiesOrderCount', facilitiesOrderCount)

        facilities.map((facility: any) => {
          const fulfillmentOrderLimit = facility.maximumOrderLimit
          if (fulfillmentOrderLimit === 0) {
            facility.orderLimitType = 'no-capacity'
          } else if (fulfillmentOrderLimit) {
            facility.orderLimitType = 'custom'
          } else {
            facility.orderLimitType = 'unlimited'
          }

          facility.orderCount = facilitiesOrderCount[facility.facilityId] ? facilitiesOrderCount[facility.facilityId] : 0;

          if(facilityOnlineGroupInformation.includes(facility.facilityId)) {
            facility.sellOnline = true
          } else {
            facility.sellOnline = false
          }
        })
      } else {
        throw resp.data
      }
    } catch(error) {
      logger.error(error)
    }

    emitter.emit("dismissLoader");
    commit(types.FACILITY_LIST_UPDATED , { facilities, total });
  },

  updateQuery({ commit }, query) {
    commit(types.FACILITY_QUERY_UPDATED, query)
  },

  clearFacilityState({ commit }) {
    commit(types.FACILITY_QUERY_UPDATED, {
      queryString: '',
      productStoreId: '',
      facilityTypeId: ''
    })
    commit(types.FACILITY_LIST_UPDATED , { facilities: [], total: 0 });
  }
}

export default actions;