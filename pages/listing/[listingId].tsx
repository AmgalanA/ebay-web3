import {
  useContract,
  // @ts-ignore
  useAddress,
  MediaRenderer,
  // @ts-ignore
  useNetwork,
  // @ts-ignore
  useNetworkMismatch,
  useOffers,
  useMakeOffer,
  useMakeBid,
  useBuyNow,
  useOwnedNFTs,
  useCreateAuctionListing,
  useAcceptDirectListingOffer,
  useListing,
  useCreateDirectListing,
} from "@thirdweb-dev/react";
import { BiUserCircle } from "react-icons/bi";
import { useRouter } from "next/router";
import CountDown from "react-countdown";

import Header from "../../components/Header";
import { ListingType, NATIVE_TOKENS } from "@thirdweb-dev/sdk";
import { useEffect, useState } from "react";
import network from "../../utils/network";
import { ethers } from "ethers";

const ListingPage = () => {
  const [minimumNextBid, setMinimumNextBid] = useState<{
    displayValue: string;
    symbol: string;
  }>();
  const [bidAmount, setBidAmount] = useState<string>("");

  const [, switchNetwork] = useNetwork();
  const networkMismatch = useNetworkMismatch();
  const address = useAddress();

  const router = useRouter();
  const { listingId } = router.query as { listingId: string };

  const { contract } = useContract(
    process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT,
    "marketplace"
  );

  const { mutate: buyNow } = useBuyNow(contract);

  const { mutate: makeOffer } = useMakeOffer(contract);

  const { mutate: makeBid } = useMakeBid(contract);

  const { mutate: acceptOffer } = useAcceptDirectListingOffer(contract);

  const { data: listing, isLoading, error } = useListing(contract, listingId);

  const { data: offers } = useOffers(contract, listingId);

  const formatPlaceholder = () => {
    if (!listing) return;

    if (listing.type === ListingType.Direct) {
      return "Enter Offer Amount";
    }

    if (listing.type === ListingType.Auction) {
      return Number(minimumNextBid?.displayValue) === 0
        ? "Enter bid Amount"
        : `${minimumNextBid?.displayValue} ${minimumNextBid?.symbol} or more`;
    }

    // TODO:Improve bid amount
  };

  useEffect(() => {
    if (!listingId || !contract || !listing) return;

    if (listing.type === ListingType.Auction) {
      fetchMinNextBid();
    }
  }, [listingId, contract, listing]);

  const fetchMinNextBid = async () => {
    if (!listingId || !contract) return;

    const { displayValue, symbol } = await contract.auction.getMinimumNextBid(
      listingId
    );

    setMinimumNextBid({
      displayValue: displayValue,
      symbol: symbol,
    });
  };

  const buyNft = async () => {
    if (networkMismatch) {
      switchNetwork && switchNetwork(network);

      return;
    }

    if (!listingId || !listing) return;

    await buyNow(
      {
        id: listingId,
        buyAmount: 1,
        type: listing.type,
      },
      {
        onSuccess: (data, variables, context) => {
          console.log("Success: ", data, variables, context);
          router.replace("/");
        },
        onError: (error, variables, context) => {
          console.log("Error: ", error, variables, context);
        },
      }
    );
  };

  const createBidOrOffer = async () => {
    try {
      if (networkMismatch) {
        switchNetwork && switchNetwork(network);

        return;
      }

      console.log(listing);

      // Direct listing
      if (listing?.type === ListingType.Direct) {
        if (
          listing.buyoutPrice.toString() ===
          ethers.utils.parseEther(bidAmount).toString()
        ) {
          buyNft();

          return;
        }

        await makeOffer(
          {
            listingId,
            quantity: 1,
            pricePerToken: bidAmount,
          },
          {
            onSuccess(data, variables, context) {
              console.log("Success: ", data, variables, context);
              setBidAmount("");
            },
            onError(error, variables, context) {
              console.log("Error: ", error, variables, context);
            },
          }
        );
      }

      // Auction listing
      if (listing?.type === ListingType.Auction) {
        await makeBid(
          {
            bid: bidAmount,
            listingId,
          },
          {
            onSuccess(data, variables, context) {
              console.log("Success: ", data, variables, context);
              setBidAmount("");
            },
            onError(error, variables, context) {
              console.log("Error: ", error, variables, context);
            },
          }
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoading)
    return (
      <div>
        <Header />

        <div className="text-center animate-pulse text-blue">
          <p>Loading item...</p>
        </div>
      </div>
    );

  if (!listing) {
    return <div>Listing not found</div>;
  }

  return (
    <div>
      <Header />

      <main className="max-w-6xl mx-auto p-2 flex flex-col lg:flex-row space-y-10 space-x-5 pr-10">
        <div className="p-10 border mx-auto lg:mx-0 max-w-md lg:max-w-xl">
          <MediaRenderer src={listing.asset.image} />
        </div>

        <section className="flex-1 space-y-5 pb-20 lg:pb-0">
          <div>
            <h1 className="text-xl font-bold">{listing.asset.name}</h1>
            <p className="text-gray-600">{listing.asset.description}</p>
            <p className="flex items-center text-xs sm:text-base">
              <BiUserCircle className="h-5" />
              <span className="font-bold pr-1">Seller:</span>
              {listing.sellerAddress}
            </p>
          </div>

          <div className="grid grid-cols-2 items-center py-2">
            <p className="font-bold">Listing Type:</p>
            <p>
              {listing.type === ListingType.Direct
                ? "Direct Listing"
                : "Auction Listing"}
            </p>

            <p className="font-bold">Buy it Now Price:</p>

            <p className="text-4xl font-bold">
              {listing.buyoutCurrencyValuePerToken.displayValue}{" "}
              {listing.buyoutCurrencyValuePerToken.symbol}
            </p>

            <button
              onClick={buyNft}
              className="col-start-2 mt-2 bg-blue-600 font-bold text-white rounded-full w-44 py-4 px-10"
            >
              Buy Now
            </button>
          </div>

          {listing.type === ListingType.Direct && offers && (
            <div className="grid grid-cols-2 gap-y-2">
              <p className="font-bold">Offers:</p>
              <p className="font-bold">
                {offers.length > 0 ? offers.length : 0}
              </p>

              {offers.map((offer) => (
                <>
                  <p className="flex items-center ml-5 text-sm italic">
                    <BiUserCircle className="h-3 mr-2" />
                    {offer.offerer.slice(0, 5) +
                      "..." +
                      offer.offerer.slice(-5)}
                  </p>

                  <div>
                    <p
                      key={
                        offer.listingId +
                        offer.offerer +
                        offer.totalOfferAmount.toString()
                      }
                      className="text-sm italic"
                    >
                      {ethers.utils.formatEther(offer.totalOfferAmount)}{" "}
                      {NATIVE_TOKENS[network].symbol}
                    </p>

                    {listing.sellerAddress === address && (
                      <button
                        onClick={() =>
                          acceptOffer(
                            {
                              listingId,
                              addressOfOfferor: offer.offeror,
                            },
                            {
                              onSuccess: (data, variables, context) => {
                                console.log(
                                  "Success: ",
                                  data,
                                  variables,
                                  context
                                );
                                router.replace("/");
                              },
                              onError: (error, variables, context) => {
                                console.log(
                                  "Error: ",
                                  error,
                                  variables,
                                  context
                                );
                              },
                            }
                          )
                        }
                        className="p-2 w-32 bg-red-500/50 rounded-lg font-bold text-xs cursor-pointer"
                      >
                        Accept Offer
                      </button>
                    )}
                  </div>
                </>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 space-y-2 items-center justify-env">
            <hr className="col-span-2" />

            <p className="col-span-2 font-bold">
              {listing.type === ListingType.Direct
                ? "Make an Offer"
                : "Bid on this Auction"}
            </p>

            {/* 
             TODO: Remaining time on auction goes here...
            */}
            {listing.type === ListingType.Auction && (
              <>
                <p>Current Minimum Bid: </p>
                <p>
                  {minimumNextBid?.displayValue} {minimumNextBid?.symbol}
                </p>

                <p>Time Remaining</p>
                <CountDown
                  date={Number(listing.endTimeInEpochSeconds.toString) * 1000}
                />
              </>
            )}

            <input
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              className="border p-2 rounded-lg mr-5"
              type="text"
              placeholder={formatPlaceholder()}
            />
            <button
              onClick={createBidOrOffer}
              className="bg-red-600 font-bold text-white rounded-full w-44 py-4 px-10"
            >
              {listing.type === ListingType.Direct ? "Offer" : "Bid"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ListingPage;
