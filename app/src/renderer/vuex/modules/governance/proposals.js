import Raven from "raven-js"
import Vue from "vue"

export default ({ node }) => {
  let emptyState = {
    loading: false,
    error: null,
    proposals: {}
  }
  const state = JSON.parse(JSON.stringify(emptyState))

  const mutations = {
    setProposal(state, proposal) {
      Vue.set(state.proposals, proposal.proposal_id, proposal)
    },
    setProposalTally(state, proposalId, tally) {
      state.proposals[proposalId].tally_result = tally
    }
  }
  let actions = {
    async reconnected({ state, dispatch }) {
      if (state.loading) {
        await dispatch(`getProposals`)
      }
    },
    resetSessionData({ rootState }) {
      // clear previous account state
      rootState.proposals = JSON.parse(JSON.stringify(emptyState))
    },
    async getProposals({ state, commit }) {
      state.loading = true
      try {
        let proposals = await node.queryProposals()
        state.error = null
        if (proposals.length > 0) {
          proposals.forEach(proposal => {
            commit(`setProposal`, proposal.value)
            // the proposal doesn't hold the tally results until it's inactive (rejected or passed)
            // TODO: enable after upgrading to latest SDK
            // if (proposal.value.proposal_status === `VotingPeriod`) {
            //   node.queryProposalTally(proposal.value.proposal_id).then(tally => {
            //     commit(`setProposalTally`, proposal.value.proposal_id, tally)
            //   })
            // }
          })
        }
      } catch (error) {
        commit(`notifyError`, {
          title: `Error fetching proposals`,
          body: error.message
        })
        Raven.captureException(error)
        state.error = error
      }
      state.loading = false
    },
    async getProposal({ state, commit }, proposal_id) {
      state.loading = true
      try {
        state.error = null
        let proposal = await node.queryProposal(proposal_id)
        commit(`setProposal`, proposal.value)
      } catch (error) {
        commit(`notifyError`, {
          title: `Error querying proposal with id #${proposal_id}`,
          body: error.message
        })
        Raven.captureException(error)
        state.error = error
      }
      state.loading = false
    },
    async submitProposal(
      {
        rootState: { wallet },
        dispatch
      },
      { title, description, type, initial_deposit, password }
    ) {
      await dispatch(`sendTx`, {
        type: `submitProposal`,
        proposer: wallet.address,
        proposal_type: type,
        title,
        description,
        initial_deposit,
        password
      })
      await dispatch(`getProposals`)
    }
  }
  return {
    state,
    actions,
    mutations
  }
}
